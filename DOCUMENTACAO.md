# Documentação Técnica — TASY Analytics (Suíte de Dashboards)

> **Documentação de criação da suíte TASY Analytics** — três dashboards hospitalares construídos do zero sobre a base de dados do TASY (Philips). Este documento explica **por que, como e com o que** cada parte foi criada, para que qualquer pessoa consiga entender, manter e criar um novo painel sem depender dos autores.

---

## Sumário
1. [Contexto e Objetivos](#1-contexto-e-objetivos)
2. [Visão Geral da Solução](#2-visão-geral-da-solução)
3. [Arquitetura](#3-arquitetura)
4. [Como o Projeto foi Criado (passo a passo)](#4-como-o-projeto-foi-criado-passo-a-passo)
5. [Design System e Layout](#5-design-system-e-layout)
6. [Modelo de Dados e Mock Determinístico](#6-modelo-de-dados-e-mock-determinístico)
7. [Controller — Fluxo Completo](#7-controller--fluxo-completo)
8. [Gráficos (Chart.js)](#8-gráficos-chartjs)
9. [Tabela Analítica](#9-tabela-analítica)
10. [KPIs, Metas e Anomalias](#10-kpis-metas-e-anomalias)
11. [Persistência e Compartilhamento](#11-persistência-e-compartilhamento)
12. [Performance, Responsividade e Acessibilidade](#12-performance-responsividade-e-acessibilidade)
13. [Contrato de API](#13-contrato-de-api)
14. [Como Criar um Novo Dashboard](#14-como-criar-um-novo-dashboard)
15. [Como Adicionar Dimensão ou Indicador](#15-como-adicionar-dimensão-ou-indicador)
16. [Correções e Decisões de Engenharia](#16-correções-e-decisões-de-engenharia)
17. [Limitações e Roadmap](#17-limitações-e-roadmap)

---

## 1. Contexto e Objetivos

Hospitais que usam o TASY acumulam milhões de registros (contas, guias, faturamento, glosas, permanência, materiais). A gestão precisa responder em segundos a perguntas como:

- *Qual convênio mais glosou este mês e por quê?*
- *Qual etapa do fluxo retém pacientes por mais tempo?*
- *Qual médico/setor mais produziu e qual o repasse?*

**Objetivo da criação**: entregar **três dashboards analíticos** com:
- **Experiência idêntica** (mesma navegação, mesmos gráficos, mesma tabela) para não re-treinar o usuário;
- **Código idêntico** (manutenção centralizada: 1 fix corrige os 3);
- **Domínio isolado** (cada um só troca dimensões, indicadores, fórmulas e textos);
- **Zero dependência de backend** para demo (mock), e **1 flag** para plugar no banco real;
- **Pronto para produção** (responsivo, acessível, imprimível, tema escuro, estável).

---

## 2. Visão Geral da Solução

```
┌─────────────────────────────────────────────────────────┐
│  *.html (View única)                                    │
│  Sidebar (dimensões/indicadores) + Header (filtros)     │
│  + KPIs + Variações + Gráficos + Tendência + Tabela     │
│  AngularJS 1.8.2 + Chart.js 4.4.9 (CDN com SRI, defer)  │
├─────────────────────────────────────────────────────────┤
│  js/api.service.js (Fonte de dados)                     │
│  USAR_MOCK=true  → mock determinístico (demo)           │
│  USAR_MOCK=false → POST /api/hospital/<dashboard>       │
├─────────────────────────────────────────────────────────┤
│  js/dashboard.controller.js (Cérebro)                   │
│  Estado, watchers, KPIs, metas, cache, hash, exports    │
├─────────────────────────────────────────────────────────┤
│  css/styles.css (Design system)                         │
│  Variáveis, grid, sticky, dark mode, responsivo, print  │
└─────────────────────────────────────────────────────────┘
```

**Três instâncias** (`glosas-por-convenio/`, `etapa/`, `pempfrg/`) copiam a mesma estrutura e só trocam o domínio.

| Dashboard | Dimensões | Indicadores | Foco |
|---|---|---|---|
| **Glosas** | 10 (Convênio, Estabelecimento, Setor, Protocolo etc.) | 12 (8 R$ + 4 %) | Perda de receita com glosas |
| **Etapa** | 6 + mês (Conta, Etapa, Convênio etc.) | 5 (Qtde Contas, Dias/Média Etapa/Alta) | Tempo de permanência |
| **Pempfrg** | 13 + mês (Médico, Procedimento, MatMed etc.) | 9 + 1 derivada (% Glosa) | Volumetria e financeiro |

---

## 3. Arquitetura

**100% estático, sem build**. Cada pasta é autossuficiente — pode ser copiada para Apache/Nginx/Tomcat/TASY e funcionar.

```
<dashboard>/
├── <nome>.html                View (Angular directives, ng-app, ng-controller)
├── css/styles.css             Tema claro/escuro + responsivo + print
├── js/api.service.js          Fonte de dados (mock ou POST)
├── js/dashboard.controller.js Todo comportamento (2300+ linhas)
└── API_CONTRATO.md            Contrato REST para o backend
```

**Dependências externas** (CDN, com `integrity` e `crossorigin`):
- `ajax.googleapis.com/ajax/libs/angularjs/1.8.2/angular.min.js`
- `cdn.jsdelivr.net/npm/chart.js@4.4.9/dist/chart.umd.min.js`
- `fonts.googleapis.com` (Inter 300-800 + JetBrains Mono 500/600)

`preconnect` para `ajax.googleapis.com`, `cdn.jsdelivr.net` e `fonts.gstatic.com` + `defer` nos scripts para não bloquear o First Paint.

**Por que AngularJS sem build?**
- Hospedagem simples em ambiente hospitalar (sem Node no servidor).
- Two-way binding resolve filtros ↔ tabela ↔ gráficos sem código manual.
- Um arquivo `.html` + dois `.js` já é o deploy.

---

## 4. Como o Projeto foi Criado (passo a passo)

### 4.1. Esqueleto
1. Criar `js/api.service.js` com `angular.module('DashboardApp', [])` + `factory('ApiService')` + `USAR_MOCK` + `basesDeDados` + `configIndicadores`.
2. Criar `js/dashboard.controller.js` com `angular.module('DashboardApp')` (sem `[]`) + `controller('DashboardController', ...)`.
3. Criar `css/styles.css` com `:root` (variáveis), `*::before, *::after {box-sizing}`, layout flex/grid, cards, tabela, gráficos.
4. Criar `*.html` com `ng-app`, `ng-controller`, sidebar, header, dashboard-scroll, canvas, tabela e modais.

### 4.2. Dados primeiro (mock)
Definir `basesDeDados[dimensão] = [labels]` e `configIndicadores[indicador] = { nome, isMoeda/isPercentual/isDecimal, baseMin/baseMax, color, badgeClass }`. Implementar `obterDadosDashboard(req)` que:
- Calcula `multPeriodo` (dia 0.05, mês 1, ano 12) e `fatorPeriodo` (semente por `periodoValor` para realismo YoY).
- Para `indicador==="todos"`: gera 1 item por label com fórmulas coerentes (ex.: Glosas: `faturado → glosado = faturado*taxa`, `recebido = faturado-glosado+retorno+adicional*0.7`).
- Para indicador individual: gera `valorRaw` por semente.
- Aplica `comparativo` (campos `_ant` e `_var`).
- Ordena por `ordem` e fatia por `limite` (`totalBase` = antes do slice).

### 4.3. Estado e filtros
Criar `config` (dimensão/indicador), `filtrosTop` (tipoPeriodo, dataDia/dataMes/dataAno, modoVisao, ordem, limite), `tipoGraficoVisual`, `filtroSerieGrafico`. Adicionar `CHAVE_*` para `localStorage` e `DIMENSOES_VALIDAS`/`INDICADORES_VALIDOS`/`MODOS_VISAO_VALIDOS` para validar restauração.

Implementar `salvarEstado()` (serializa datas em ISO, valida limites) e `restaurarEstadoSalvo()` (valida cada campo, `isValidDate`, `isTipoGraficoValido`). Em telas ≤940px iniciar `sidebarColapsada=true`.

### 4.4. Carga e cache
Implementar `solicitarDados()` com debounce 150ms, `tokenRequisicao` anti-race, payload `{dimensao, indicador, tipoPeriodo, periodoValor, modo, ordem, limite}`, chamada `ApiService.obterDadosDashboard`. No `then`: salvar cache, renderizar gráficos, carregar tendência, e se `totalBase > dados.length` buscar base completa em segundo plano para KPIs/totais corretos.

Adicionar `stale-while-revalidate`: `aplicarCacheInicial()` pinta instantaneamente a última resposta compatível (`sig` por payload) enquanto a requisição real revalida.

### 4.5. Gráficos, tabela e KPIs
Implementar `renderizarGraficos()` (Chart.js), `aplicarFiltroTabela()` + `calcularTotaisTabela()`, `calcularKPIs()` (usa `fonteAgregados` quando disponível), `marcarAnomalias()`, `calcularMaioresVariacoes()`, e os watchers (`$watchGroup` de dimensão/indicador/período/visão/limite e de tendência).

### 4.6. Responsividade e acessibilidade
Adicionar `safeApply` helper (evita `$digest already in progress`), `ResizeObserver` no `.dashboard-scroll` + `visualViewport` + fallback `setInterval` + debounce 200ms com `requestAnimationFrame`, limpeza em `$destroy`, e toda a camada CSS/ARIA descrita nas seções 12 e 16.

---

## 5. Design System e Layout

Mesma estrutura nos 3 dashboards:

1. **Sidebar retrátil** — marca (`brand-icon` + `brand-tag`), busca (`Ctrl+K` → `#buscaSidebarInput`), Seção 1 *Dimensão Analisada* agrupada, Seção 2 *Métricas/Indicadores* com `dot-color`, hints no rodapé. Vira drawer com backdrop ≤940px (`transform:translateX`).
2. **Header** — toggle sidebar, Período (select + inputs condicionais `ng-if`), presets (Hoje/Este Mês/Mês Anterior/Ano Atual), Visão (Normal/Comparativo/YoY), Ordenação, Exibir (Top 5/10/25/50/Todos) + ações (tema, compartilhar, Views, Copiar, Exportar dropdown, Imprimir).
3. **Period banner** — badge do período atual + `vs` anterior + meta-informações.
4. **Metas bar** — chips semáforo + botão de configuração (painel com inputs).
5. **KPI grid** — 5 cards clicáveis (multivariado) ou contextuais (individual), com `::before` colorido por indicador.
6. **Variações** — colunas Altas/Quedas, clique leva à linha (`focarLinhaTabela`).
7. **Análise Gráfica** — `chart-type-selector` (Barras Horizontais/Colunas/Rosca), pills de séries, botão inverter ordenação, `charts-grid` (comparativo lado a lado >1100px, coluna única ≤1100px), `chart-scroll-wrapper` (420px, `contain: layout paint`).
8. **Evolução Temporal** — seletor de ano + pills, linha tracejada = ano anterior.
9. **Detalhamento Analítico** — toolbar (busca `/`, colunas, anomalias, dicionário), tabela individual ou multivariada, `tfoot` sticky de totais, linhas com drill-down.
10. **Sumário Comparativo** — rodapé com atual × anterior × variação.
11. **Modais** — nomear view, drill-down.
12. **Toast** — `role="status" aria-live="polite"` + dot colorido.

**CSS**: variáveis centralizadas (`--bg-*`, `--primary`, `--accent`, `--text-*`, `--color-*`), `will-change: transform` + `contain` nos wrappers de gráfico, `sr-only` para `h1`, `@media print` unificado, `@media (prefers-reduced-motion: reduce)`.

---

## 6. Modelo de Dados e Mock Determinístico

Toda a geração vive em `api.service.js`:

- **Sementes**: `baseSeed = (index*17 + label.length*23) %100 /100` ou hash do label para drill-down. Mesmo input → mesmo output (bom para demo e para `fatorPeriodo` do YoY).
- **Mult-período**: `dia 0.05`, `mes 1`, `ano 12` + `fatorPeriodo` por `marca = ano*12+mes` (ou `ano`).
- **Coerência por domínio**:
  - *Glosas*: `faturado → glosado (2.5-9%) → glosaAceita (20-55% da glosa) → reapresentado → retorno → adicional (1-4.5%) → recebido = faturado-glosado+retorno+adicional*0.7`.
  - *Etapa*: `qtdContas → mediaEtapa (0.8-6.5 dias) → diasEtapa = qtd*media → mediaAlta → diasAlta`.
  - *Pempfrg*: `qtdContas → qtdProc (3-15×) → qtdMatmed (1.5-7.5×) → produzido → faturado (90-98% prod) → glosado (2-9%) → adicional → repasse (25-45% fat) → recebido`.

Cada indicador tem `baseMin/baseMax` para escala realista e `color/badgeClass` para UI.

---

## 7. Controller — Fluxo Completo

### 7.1 Filtros, períodos e presets
`filtrosTop.tipoPeriodo` controla qual input aparece (`ng-if`). `dataDia`/`dataMes` são **objetos `Date`** (exigência do Angular para `input[type=date/month]`). `aplicarPreset` seta os filtros; `isPresetAtivo` compara filtros ↔ hoje (não flag).

`atualizarRotulosPeriodo` gera `infoPeriodo.rotuloAtual/rotuloAnterior` com nomes de meses por extenso e sufixo YoY.

### 7.2 Comparativo YoY (client-side)
O contrato só aceita `modo: normal|comparativo`. Para `yoy`:
1. Busca período atual (`payload` normal).
2. Busca mesmo período −1 ano (`deslocarPeriodoAnos` + `limite:'todos'`).
3. `mesclarComparativoYoy()` casa por `normalizarTexto(label)` e cria os mesmos campos `_ant/_var` — a UI não sabe que é YoY.

### 7.3 Ordenação Top-N real
Com Top-N, ordenar por coluna busca os **extremos verdadeiros da base completa** (`baseCompletaDados`, obtida em background quando `totalBase > dados.length`), não só reordena o recorte (`reconstruirExibicao`). Cabeçalhos têm 3 estados: `desc → asc → neutro` + `getIconeOrdenacao` + `aria-sort`.

### 7.4 Watchers e carga
```js
$watchGroup(['config.dimensao','config.indicador','filtrosTop.tipoPeriodo', ...,'filtrosTop.modoVisao','filtrosTop.limite'],  () => { atualizarRotulosPeriodo(); solicitarDados(); })
$watchGroup(['config.indicador','filtrosTop.modoVisao','tendenciaAno.valor'], () => carregarTendencia())
```
`obterValorDataEfetiva()` retorna `dataDia/dataMes/dataAno` conforme `tipoPeriodo`. `tokenRequisicao` descarta respostas defasadas.

`recalcularAgregados(res, dadosCompletos)` define `fonteAgregados` (base completa se houver), recalcula `totalParticipacao`, conformidade e chama `reconstruirExibicao()` para que a exibição reflita os extremos reais quando a base completa chega após a 1ª pintura.

---

## 8. Gráficos (Chart.js)

`renderizarGraficos(dadosResp)` destrói `chart1/chart2`, define `Chart.defaults.font.family`, escolhe `chartType` (`bar` horizontal via `indexAxis:'y'`), monta `datasets1/datasets2` e `scalesConfig`:

- **Multivariado**: filtra `configMap` por `filtroSerieGrafico` (ex.: Glosas: Todos/Financeiro/Percentuais/Glosas vs Recuperação; Etapa: Etapa/Alta/Contas; Pempfrg: Financeiro/Quantidades/Fat×Glosa×Rec). Usa eixos duplos quando há R$ e % (`xFinanc/xPct` ou `yFinanc/yPct`).
- **Individual**: 1 dataset + opcional `datasets2` (anterior) quando comparativo; `doughnut` com paleta cíclica (`i % paleta.length`) + `borderColor` do tema.

Plugin `rotulosBarras` desenha o valor no fim da barra (só individual). Opções: `responsive:true`, `maintainAspectRatio:false`, `animation:400ms`, `tooltip` com `fmtValorCurto` e variação.

`calcularAlturaContainer(qtd, modoTodos, tipo)` → `65px` por barra (multivariado) ou `34px` (individual), mínimo 380px, **máximo 900px** (evita OOM com `limite:todos` grande).

Tendência (`chart3`) e drill-down (`chartDrill`) são linhas com `tension:0.35`, série anterior tracejada `[6,4]`, ordenação calendário Jan-Dez.

---

## 9. Tabela Analítica

- `definicaoColunas = [{key, rotulo, badgeClass, inverterDelta?, isPercentual?}]` é a fonte única de colunas.
- Visibilidade: `colunasVisiveis[key] → boolean` + `localStorage` + `getColunasVisiveis()`.
- `aplicarFiltroTabela()` filtra `respostaBackend.dados` por `normalizarTexto(label)` + `filtrosBusca.tabela`; `calcularTotaisTabela()` soma valores brutos e calcula percentuais por **razão** (ex.: Glosas: `pct_glosado = glosado/faturado*100`; Etapa: `media_etapa = dias_etapa/qtd_contas`) — nunca média simples.
- `classeDelta(item,col)` retorna `text-green/text-red/delta-neutro` conforme `col.inverterDelta`.
- `ordenarTabela(campo)` alterna `colunaOrdenada/direcaoOrdenacao` e chama `reconstruirExibicao()` (que busca extremos reais da base completa).
- `focarLinhaTabela(label)` limpa busca se necessário, seta `linhaFocada`, `querySelector('tr[data-label="..."]')` com `CSS.escape` + fallback `cssEscapeFallback`, `scrollIntoView({smooth, block:center})` e limpa após 2.4s.
- Sticky: `th` top:0, `tfoot td` bottom:0, primeira coluna da `tbl-multi` left:0 + fundos por tema.

---

## 10. KPIs, Metas e Anomalias

**KPIs (multivariado)** usam `fonteAgregados` (base completa se houver):
- *Glosas*: faturado, recebido, a receber, glosado (taxa), reapresentado, adicional, retorno + taxas.
- *Etapa*: dias/médias de etapa/alta + qtd contas + variações.
- *Pempfrg*: faturado, recebido, glosas (taxa semáforo), ticket médio, repasse.

**KPIs (individual)**: soma, média, líder real (`max valorRaw` da base, não 1º da ordenação), variação global.

**Metas**: `METAS_PADRAO` por dashboard (ex.: Glosas: Glosa ≤4%, Aceita ≤1.5%, Recebido ≥95%; Etapa: Média Etapa ≤4d, Média Alta ≤12d; Pempfrg: Taxa Glosa ≤5%, Recebido ≥90%) + `CHAVE_METAS` + `metaStatus(chave)` (`max`/`min`). `calcularConformidade*` conta itens dentro da meta principal.

**Anomalias**: `limiarAnomalia=25%` + `destacarAnomalias` toggle (persistido). `marcarAnomalias`: em comparativo, item é anômalo se **qualquer** coluna visível tiver `|Δ%|≥limiar` (multivariado) ou `|variacao|≥limiar` (individual). Painel **Maiores Variações** ordena por `Δ%` e mostra top 5 altas/quedas da métrica selecionada (`painelVarMetrica.metrica`).

---

## 11. Persistência e Compartilhamento

Chaves `localStorage` namespaced (`glosas_/etapa_/pempfrg_ + _dashboard_*`):
- `estado_v1`: dimensão, indicador, tipoPeriodo, modoVisao, ordem, limite, dataAno, dataDia (ISO), dataMes (YYYY-MM), tipoGrafico, serieGrafico
- `colunas_v1`: visibilidade das colunas
- `tema_v1`: `light|dark` (detecta `prefers-color-scheme` no boot)
- `metas_v1`, `anomalia_v1` (on/limiar), `views_v1` (até 20), `cache_v1` (sig + quando + res)

**Views salvas**: `capturarEstadoVisao()` → `{viewsSalvas: [{nome, desc, estado}]}` → `localStorage`. Modal com `novaView.nome` (objeto para não sombrear em `ng-if`).

**Link compartilhável**: `construirHashVisao()` → `#d=&i=&tp=&dd=&dm=&da=&mv=&o=&l=` + `history.replaceState`. `parseHashEstado()` (via `URLSearchParams`) tem **prioridade** sobre `restaurarEstadoSalvo()` e é aplicado antes do primeiro `solicitarDados()`.

**Cache**: `assinaturaDePayload` (`dimensão|indicador|tipoPeriodo|periodoValor|modo|ordem|limite`) → `gravarCacheResposta`/`lerCacheResposta` → `aplicarCacheInicial()` pinta stale enquanto revalida (toast “Exibindo consulta salva de …”).

---

## 12. Performance, Responsividade e Acessibilidade

**Performance**
- `defer` nos 4 scripts + `preconnect` para CDNs e fonts.
- Debounce 150ms (dados) e 200ms (resize) + `requestAnimationFrame` antes de medir/pintar.
- `stale-while-revalidate` para abertura instantânea.
- `will-change: transform` + `contain: layout paint` nos wrappers de gráfico/canvases.

**Responsividade** (criada para funcionar de 320px a 4K)
- `width:100%` (não `100vw`) + `max-width:100%` + `min-width:0` anti-blowout em `layout`, `main-content`, `charts-grid`, `chart-scroll-wrapper`, `chart-container-inner`, `charts-grid>div`.
- Breakpoints: 1100 (comparativo vira coluna única, tabela compacta), 940 (sidebar vira drawer com `transform:translateX` + backdrop), 700 (header com wrap, `chart-scroll-wrapper` 360px), 380 (kpi 1 coluna, colunas 1 coluna).
- Tabelas: `overflow-x:auto` + `max-height:480px` + `min-width:720px` para `tbl-multi`.
- Dropdowns: `max-width:calc(100vw -24px)`.

**Acessibilidade**
- `h1.sr-only` por dashboard, `aside[aria-label]`, `th[scope="col"]` + `ng-attr-aria-sort`, `li[role="button"][aria-selected]`, `canvas[role="img"][aria-label]`, `svg[aria-hidden][focusable="false"]`, `select[aria-label]`, `empty-state[role="status"][aria-live]`, `toast[role="status"][aria-live="polite"]`, `input[aria-label]`.
- `ativarTecla` (Enter/Espaço) para todo `role="button"`, `:focus-visible` com `outline`, `tabindex` correto.
- Contraste: `--text-light`/`--text-muted` revisados, `sr-only` e `prefers-reduced-motion` respeitados.

---

## 13. Contrato de API

Cada `API_CONTRATO.md` especifica:
- **Requisição**: `POST /api/hospital/<dashboard>` com `{dimensao, indicador, tipoPeriodo, periodoValor, modo, ordem, limite, rotulo?}` — validação e exemplos.
- **Resposta individual** (`indicador !== "todos"`): `{nomeDimensao, nomeIndicador, modoTodos:false, isMoeda/isPercentual/isDecimal, color, badgeClass, totalBase, dados:[{label, valorRaw, valorFormatado, valorAnteriorRaw?, valorAnteriorFormatado?, variacao?}]}`.
- **Resposta multivariada** (`indicador==="todos"`): `{nomeDimensao, modoTodos:true, totalBase, dados:[{label, <indicador>:number, <indicador>_fmt:string, <indicador>_ant?:number, <indicador>_var?:number, valorRawSort}]}` + sufixos `_fmt/_ant/_var`.
- **Erros**: `{mensagem}` → toast + botão “Tentar Novamente”; HTTP sem body → `Falha na consulta (HTTP <status>)`.
- **Integração**: trocar `USAR_MOCK=false` + `ENDPOINT` e mapear campos TASY ↔ contrato no backend ou no `then` do `$http` (timeout 10s, validação de schema e de `dimensão/indicador/limite` já no mock).

Ver arquivos: `glosas-por-convenio/API_CONTRATO.md`, `etapa/API_CONTRATO.md`, `pempfrg/API_CONTRATO.md`.

---

## 14. Como Criar um Novo Dashboard

1. Copiar `glosas-por-convenio/` → `novo/`.
2. Em `js/api.service.js`: trocar `ENDPOINT`, `basesDeDados`, `nomesDimensao`, `configIndicadores` (com `baseMin/baseMax/color/badgeClass/isMoeda/isPercentual/isDecimal`), e fórmulas do mock (coerência entre indicadores).
3. Em `js/dashboard.controller.js`: atualizar `DIMENSOES_VALIDAS`/`INDICADORES_VALIDOS`, `definicaoColunas`, `METAS_PADRAO`, `PALETA_ESCURA_INDICADORES`, KPIs em `calcularKPIs`/`calcularTotaisTabela`, séries em `renderizarGraficos`/`renderizarTendencia`, `dicionarioIndicadores` e textos.
4. Em `css/styles.css`: trocar `--color-*` (claro e escuro) + `.badge-*`/`.ind-*`/`kpi-card::before`.
5. Em `*.html`: nome, marca, sidebar (dimensões/indicadores), KPI cards, pills de série, `title/meta description`.
6. Renomear chaves `localStorage` (`novo_dashboard_*`) e `API_CONTRATO.md`.

---

## 15. Como Adicionar Dimensão ou Indicador

**Dimensão**:
1. `api.service.js`: `basesDeDados.nova = [...]`, `nomesDimensao.nova = 'Rótulo'`.
2. Controller: `DIMENSOES_VALIDAS.push('nova')`.
3. HTML: `<li>` na sidebar (`filtrarItem`, `selecionarDimensao`, `aria-selected`).

**Indicador**:
1. `api.service.js`: `configIndicadores.novo = { nome, isMoeda/isPercentual/isDecimal, baseMin/baseMax, color, badgeClass }` + mock (atual/_ant/_var) + `getConfigIndicadores`.
2. Controller: `INDICADORES_VALIDOS`, `definicaoColunas` (c/ `inverterDelta` se aumento for ruim), `calcularKPIs`/`calcularTotaisTabela`, `dicionarioIndicadores`.
3. CSS: `--color-novo`, `.badge-novo`, `.ind-novo`, `::before`.
4. HTML: item na sidebar + card KPI (se destaque) + pill de série.

---

## 16. Correções e Decisões de Engenharia

- **Objetos no scope** para modelos sob `ng-if` (`tendenciaAno.valor`, `novaView.nome`, `painelVarMetrica.metrica`) — evita shadowing do escopo-filho do Angular.
- **alternarPainel(nome, forcar)** sempre no controller (atribuição inline em `ng-click` criaria cópia sombreada).
- **inverterDelta** na coluna define se aumento é desfavorável — usado em Δ% da célula, variações e KPI.
- **Tokens anti-race** (`tokenRequisicao/tokenTendencia/tokenDrill`) descartam respostas antigas.
- **safeApply** + limpeza em `$destroy` (remove `click/keydown/resize/orientationchange/visualViewport`, `ResizeObserver.disconnect`, `clearInterval`, `$timeout.cancel`, `chart.destroy`) — evita “$digest already in progress” e memory leak em SPA.
- **isValidDate** + whitelist de `limite`/`ordem`/`tipoGrafico`/`dataAno` + validação de `fatorPeriodo` + `limite` com `radix` e fallback — evita `NaN`/`Invalid Date` em cascata.
- **cssEscapeFallback** + `CSS.escape` — evita quebra/injeção no seletor `tr[data-label]`.
- **Doughnut paleta cíclica** (`i % paleta.length`) — evita falta de cor com >10 itens.
- **Altura de gráfico limitada a 900px** — evita OOM com `limite:todos` grande.
- **SRI** nos CDNs + `preconnect` + `defer`.
- **Handler global de clique-fora** protege `exportar-dropdown/colunas-dropdown/views-dropdown/metas-bar/btn-dicionario/dicionario-panel`.

---

## 17. Limitações e Roadmap

- YoY depende de labels estáveis entre anos (casamento por `normalizarTexto`).
- Drill-down mensal exige `rotulo` no backend (mock já implementa; real degrada graciosamente).
- Excel exporta a tabela filtrada (não a base completa) — CSV completo cobre o caso.
- Próximos passos: SSO/autorização por convênio/estabelecimento, alertas de anomalia (e-mail/Teams), paginação virtual, testes unitários/E2E, agregação server-side para bases muito grandes.

---

*Criado para o TASY — cada novo dashboard é uma cópia consciente do mesmo esqueleto, com domínio próprio e sem surpresas.*
