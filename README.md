# TASY Analytics — Suíte de Dashboards Hospitalares

> **Plataforma de indicadores hospitalares construída sobre o TASY (Philips)**. Este repositório contém a **criação completa, do zero, de três dashboards analíticos** — com design system unificado, engenharia frontend sem build e contrato de API padronizado. Cada dashboard é autossuficiente (HTML + CSS + JS + mock) e pode rodar sem backend.

---

## 1. O que foi construído

Este projeto cria uma suíte de **Business Intelligence hospitalar** para apoio à gestão:

| Dashboard | Pasta | Problema que resolve | Dimensões | Indicadores |
|---|---|---|---|---|
| **Glosas por Convênio** | `glosas-por-convenio/` | Onde e por que a receita é perdida com glosas | 10 (Convênio, Estabelecimento, Etapa do faturamento etc.) | 12 (8 valores R$ + 4 taxas %) |
| **Etapa / Tempo de Permanência** | `etapa/` | Gargalos de permanência no fluxo assistencial | 6 + mês interno (Conta, Etapa, Convênio etc.) | 5 (Qtde Contas, Dias/Média Etapa, Dias/Média Alta) |
| **Produção, Faturamento e MatMed** | `pempfrg/` | Volumetria assistencial, financeiro e repasse médico | 13 + mês interno (Médico, Procedimento, MatMed etc.) | 9 + 1 derivada (% Glosa) |

**Todos compartilham o mesmo código de base** (layout, gráficos, tabela, filtros, exportações, responsividade, tema, persistência). O que muda é o **domínio**: lista de dimensões, lista de indicadores, fórmulas, metas e textos.

```
projetoindicadores/
├── glosas-por-convenio/
│   ├── glosasporconvenio.html
│   ├── css/styles.css
│   ├── js/api.service.js
│   ├── js/dashboard.controller.js
│   └── API_CONTRATO.md
├── etapa/
│   ├── Etapa.html
│   ├── css/styles.css
│   ├── js/api.service.js
│   ├── js/dashboard.controller.js
│   └── API_CONTRATO.md
├── pempfrg/
│   ├── pempfrg.html
│   ├── css/styles.css
│   ├── js/api.service.js
│   ├── js/dashboard.controller.js
│   └── API_CONTRATO.md
├── README.md          ← você está aqui (guia geral de criação)
└── DOCUMENTACAO.md    ← documentação técnica profunda
```

---

## 2. Stack — por que essas escolhas

| Camada | Tecnologia | Motivo |
|---|---|---|
| **View** | **AngularJS 1.8.2** | Two-way binding sem build, arquivos estáticos puros, fácil de hospedar no TASY/Apache/Nginx |
| **Gráficos** | **Chart.js 4.4.9 (UMD)** | Barras, colunas, rosca e linha com 1 lib; API estável |
| **Estilo** | **CSS puro + variáveis** | Tema claro/escuro via `html[data-theme]`, sem pré-processador |
| **Fontes** | **Inter + JetBrains Mono** (Google Fonts) | Legibilidade clínica + números tabulares |
| **Dados** | **Mock determinístico em JS** ou **POST real** | Demo sem backend; troca por 1 flag (`USAR_MOCK`) |

> **Zero build, zero npm install**. Basta abrir o `.html` no navegador.

CDNs com **SRI (Subresource Integrity)** e `defer` para não bloquear o First Paint:
```html
<script defer src="https://ajax.googleapis.com/ajax/libs/angularjs/1.8.2/angular.min.js"
        integrity="sha384-..." crossorigin="anonymous"></script>
```

---

## 3. Como rodar (2 minutos)

```bash
# Opção 1 — abrir direto (file://)
start glosas-por-convenio\glosasporconvenio.html

# Opção 2 — servidor local (recomendado: hash de compartilhamento funciona melhor em http)
python -m http.server 8080
# ou
npx http-server -p 8080
# → http://localhost:8080/glosas-por-convenio/glosasporconvenio.html
```

Por padrão `USAR_MOCK = true` em `js/api.service.js` — dados hospitalares coerentes e **determinísticos** (mesmos filtros → mesmos números), ideal para validar layout sem banco.

Para plugar no backend real:
```js
// em js/api.service.js
var USAR_MOCK = false;
var ENDPOINT = '/api/hospital/glosas-por-convenio'; // ajuste a URL
```

---

## 4. Como um dashboard funciona (criação passo a passo)

### 4.1 HTML — a página
`*.html` é a **única página** do dashboard:
- `ng-app="DashboardApp"` + `ng-controller="DashboardController"` ativam o Angular.
- `<aside class="sidebar">` — dimensões e indicadores (com `aria-selected`, `role="button"`).
- `<header class="top-header">` — período, presets, visão, ordenação, limite e ações (tema, Views, Copiar, Exportar, Imprimir).
- `dashboard-scroll` — KPIs, variações, gráficos, evolução temporal, tabela e modais.
- Canvas com `role="img"` + `h1.sr-only` para acessibilidade.

### 4.2 CSS — o design system
`css/styles.css` (~70KB) é **idêntico nos 3** — só muda a paleta (`--color-*`) no `:root`:
- Variáveis: `--primary`, `--accent`, `--bg-body`, `--text-*`, `--color-val-*` (por indicador).
- Layout: flex (`sidebar` 310px + `main-content` flex:1), grid (`kpi-grid`, `charts-grid`), sticky (`th`, `tfoot`, primeira coluna da tabela multivariada).
- Tema escuro: `html[data-theme="dark"]` sobrescreve todas as variáveis.
- Responsivo: `100%` (não `100vw`), `min-width:0` anti-blowout, breakpoints 1100/940/700/380, sidebar vira drawer com backdrop, tabela com `min-width:720px` + scroll horizontal.

### 4.3 JS — ApiService (dados)
`js/api.service.js` isola **toda** a origem de dados:
```js
ApiService.obterDadosDashboard({ dimensao, indicador, tipoPeriodo, periodoValor, modo, ordem, limite, rotulo })
```
- Se `USAR_MOCK = true`: gera dados em memória (200ms delay) com sementes por label/índice/período.
- Se `false`: `.$http.post(ENDPOINT, req, {timeout:10000})` + validação de schema.

Detalhe completo em cada `API_CONTRATO.md`.

### 4.4 JS — DashboardController (cérebro)
`js/dashboard.controller.js` (~2300 linhas) concentra o comportamento:
- **Estado**: `config` (dimensão/indicador), `filtrosTop` (período, modo, ordem, limite), `tipoGraficoVisual`, `filtroSerieGrafico`.
- **Persistência**: `localStorage` namespaced (`glosas_/etapa_/pempfrg_`) + `parseHashEstado` (`#d=&i=&tp=&...`).
- **Carga**: `solicitarDados()` → `ApiService` → `recalcularAgregados()` → `renderizarGraficos()` → `carregarTendencia()`.
- **Top-N real**: quando `limite ≠ todos` e `totalBase > dados.length`, busca a base completa em segundo plano para KPIs/totais corretos e para que ordenação por coluna traga os verdadeiros extremos.
- **Gráficos**: Chart.js com plugin `rotulosBarras`, eixos duplos (R$ × %), ResizeObserver + debounce (Zoom, rotação, toggle sidebar).
- **Tabela**: filtro em tempo real, ordenação 3 estados, Δ% com `inverterDelta`, anomalias, colunas configuráveis.
- **Outros**: metas semáforo, variações, drill-down, views, hash compartilhável, exportações (CSV, CSV completo, Excel, PNG, PDF), cache `stale-while-revalidate`, atalhos (`Ctrl+K` / `/` / `Ctrl+E` / `Esc`).

---

## 5. Funcionalidades (comuns aos 3)

- 🎛️ Sidebar com busca (`Ctrl+K`) e agrupamento por domínio
- 📅 Período `dia/mês/ano` + presets (Hoje, Este Mês, Mês Anterior, Ano Atual)
- 🔀 Visões: **Normal**, **Comparativo vs. anterior**, **YoY** (mesmo período do ano passado, mesclado client-side)
- 🎯 Metas configuráveis com semáforo e conformidade (X/N itens na meta)
- 💡 KPIs clicáveis → focam o indicador
- 📈 Maiores variações (altas/quedas) → clique leva à linha da tabela
- 🕐 Evolução temporal 12 meses (linha tracejada = ano anterior)
- 🔍 Drill-down por linha → modal com evolução mensal do item
- 📋 Tabela multivariada: colunas, ordenação, Δ% favorável/desfavorável, anomalias (≥25%), dicionário
- 💾 Views salvas (20) + link compartilhável (`#hash`)
- 📤 Exportar: CSV visível, CSV base completa, Excel (.xls), PNG do gráfico, PDF de impressão
- 🌗 Tema claro/escuro persistente
- ⚡ Cache stale-while-revalidate (abertura instantânea)
- 📱 Responsivo completo + acessível (ARIA, teclado, contraste)

---

## 6. Como criar uma nova dimensão ou indicador

### Nova dimensão
1. `api.service.js` → `basesDeDados` (lista de labels) + `nomesDimensao` (rótulo).
2. `dashboard.controller.js` → `DIMENSOES_VALIDAS.push('nova_dim')`.
3. `*.html` → novo `<li>` na sidebar (com `role="button"` e `aria-selected`).

### Novo indicador
1. `api.service.js` → `configIndicadores['novo'] = { nome, isMoeda/isPercentual/isDecimal, baseMin/baseMax, color, badgeClass }` + mock (atual/_ant/_var).
2. `dashboard.controller.js` → `INDICADORES_VALIDOS`, `definicaoColunas` (com `inverterDelta` se aumento for ruim), KPIs, dicionário.
3. `css/styles.css` → `--color-novo` (claro/escuro), `.badge-novo`, `.ind-novo`, `kpi-card::before`.
4. `*.html` → item na sidebar + card KPI (se for destaque) + pill de série.

---

## 7. Como criar um 4º dashboard (ex.: “Centro Cirúrgico”)

1. Copie uma pasta existente (ex.: `glosas-por-convenio/` → `centro-cirurgico/`).
2. Troque o **domínio**: `basesDeDados`, `nomesDimensao`, `configIndicadores`, `METAS_PADRAO`, KPIs, séries, dicionário, textos do `*.html`.
3. Renomeie as chaves de `localStorage` (`<prefix>_dashboard_*`) e o `ENDPOINT`.
4. Ajuste a paleta `--color-*` no CSS.
5. Atualize `API_CONTRATO.md`.
6. Pronto — layout, gráficos, tabela, responsividade e integrações vêm prontos.

---

## 8. Integração com backend real

Cada `API_CONTRATO.md` documenta requisição e duas respostas (individual e multivariada), sufixos `_fmt/_ant/_var`, erros e passos de integração. Resumo:

```js
POST /api/hospital/<dashboard>
{ dimensao, indicador, tipoPeriodo, periodoValor, modo, ordem, limite, rotulo? }
→ { nomeDimensao, modoTodos, isMoeda/isPercentual/isDecimal, color, badgeClass, totalBase, dados:[{label, valor_faturado, valor_faturado_fmt, ...}] }
```

`limite` é server-side; `totalBase` é total antes do slice. Drill-down é a extensão `rotulo` (quando `dimensao:"mes"` retorna 12 pontos).

---

## 9. Qualidade — o que foi validado e corrigido

- **Responsividade**: `100vw→100%`, `min-width:0` anti-blowout, `chart-scroll-wrapper` com `contain`, altura de gráfico limitada a 900px, breakpoints 380/700/940/1100, sidebar drawer com `safeApply` e `ResizeObserver` + fallback.
- **Acessibilidade**: `aria-selected`, `aria-sort`, `scope="col"`, `aria-hidden` em SVGs, `sr-only h1`, `aria-label` em selects, `role="status"` em toasts, foco visível.
- **Performance**: `defer` nos CDNs, `will-change`/`contain` nos canvases, debounce 150ms (dados) e 200ms (resize), `stale-while-revalidate`.
- **Robustez**: `safeApply` anti “$digest already in progress”, limpeza de listeners em `$destroy` (evita leak), `isValidDate`, whitelist de `limite`/`ordem`/`tipoGrafico`, `isValidDate` em `fatorPeriodo`, timeout 10s no `$http`, validação de `configIndicadores`, `limite` com radix, paleta doughnut cíclica, validação de `dataAno`.

Detalhe completo e decisões de criação em `DOCUMENTACAO.md`.

---

## 10. Documentação

- **Este README** — visão geral e guia de criação.
- **[DOCUMENTACAO.md](DOCUMENTACAO.md)** — arquitetura profunda, fluxos, agregações, persistência, responsividade, acessibilidade e roadmap.
- **`*/API_CONTRATO.md`** — contrato REST por dashboard (Glosas, Etapa, Pempfrg).

---

## 11. Roadmap sugerido

- Autenticação/SSO + autorização por estabelecimento/convênio.
- Alertas automáticos de anomalia (e-mail/Teams).
- Testes unitários (controller) e E2E (Playwright/Cypress).
- Virtualização de tabela para bases > 500 linhas.
- Exportação agendada e paginação server-side.

---

*Construído para o ecossistema TASY — pronto para plugar no seu banco hospitalar.*
