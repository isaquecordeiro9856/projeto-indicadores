# TASY Analytics — Suíte de Dashboards Hospitalares

> **Este projeto é uma melhoria (refactor + upgrade funcional) das dashboards analíticas construídas sobre os dados do TASY** (sistema de gestão hospitalar). Os três painéis nasceram como MVPs independentes, cada um com um nível diferente de funcionalidades — esta versão **padroniza todos eles em uma base única de design, comportamento e código**, herdando automaticamente todas as evoluções do dashboard mais maduro (Glosas por Convênio), mantendo apenas o domínio de cada um (dimensões, indicadores e KPIs próprios).

---

## Os 3 Dashboards

| Dashboard | Pasta | Foco | Indicadores |
|---|---|---|---|
| **Glosas por Convênio** | [`glosas-por-convenio/`](glosas-por-convenio/) | Perda de receita com glosas e faturamento por convênio | 8 valores financeiros (R$) + 4 taxas (%) |
| **Etapa / Tempo de Permanência** | [`etapa/`](etapa/) | Tempo de permanência por etapa do processo assistencial | Qtde Contas, Dias/Média Etapa, Dias/Média Alta |
| **Produção, Faturamento e MatMed** (`pempfrg`) | [`pempfrg/`](pempfrg/) | Volumetria de procedimentos/exames e materiais, financeiro e repasse médico | 3 quantidades + 6 valores (R$) + `% Glosa` derivada |

Cada pasta contém:

```
<dashboard>/
├── <nome>.html              # View AngularJS (estrutura única em todos)
├── css/styles.css           # Tema claro/escuro completo (idêntico entre os 3)
├── js/api.service.js        # Fonte de dados: mock determinístico OU POST real
├── js/dashboard.controller.js  # Todo o comportamento do painel
└── API_CONTRATO.md          # Contrato REST para integração com backend real
```

## Stack Técnica

- **AngularJS 1.8.2** — two-way binding, sem build step (arquivos estáticos puros)
- **Chart.js 4.4.9** — gráficos de barras/colunas/rosca/linha (CDN com **SRI hash** de integridade)
- **Fontes:** Inter + JetBrains Mono (Google Fonts)
- **Zero dependências externas** além dos CDNs acima (exportações Excel/PNG/CSV são gerados localmente)

## Como Rodar

Não há build. Basta abrir o `.html` de qualquer pasta no navegador, ou servir estaticamente:

```bash
# opção 1: abrir direto
start etapa\Etapa.html

# opção 2: servidor local (recomendado para o link compartilhável funcionar bem)
python -m http.server 8080
# → http://localhost:8080/etapa/Etapa.html
```

Por padrão os dados são **mockados** (`USAR_MOCK = true` em `js/api.service.js`) com dados hospitalares coerentes e determinísticos — ideal para demo/validação sem backend. Para plugar num backend real, veja o `API_CONTRATO.md` da pasta correspondente.

## Funcionalidades (padrão único nos 3)

- 🎛️ **Dimensões e indicadores selecionáveis** na sidebar com filtro de busca (`Ctrl+K`)
- 📅 **Períodos** dia/mês/ano + presets rápidos (Hoje · Este Mês · Mês Anterior · Ano Atual)
- 🔀 **3 modos de visão:** Atual · Comparativo vs. anterior · Comparativo vs. ano passado (**YoY**, mesclado client-side)
- 🎯 **Metas executivas configuráveis** com semáforo (verde/vermelho) e contador "X/N itens na meta"
- 💡 **KPI cards clicáveis** (focam o indicador correspondente na sidebar) com variação vs. período anterior
- 📈 **Painel de Maiores Variações** (altas/quedas) com clique que rola até a linha na tabela
- 🕐 **Evolução Temporal 12 meses** com série tracejada do ano anterior e filtros de séries
- 🔍 **Drill-down por item:** modal com KPIs do item + gráfico de evolução mensal
- 📋 **Tabela multivariada** com colunas configuráveis, ordenação de 3 estados (com **Top-N real da base completa**), Δ% colorido por "favorável/desfavorável", destaque de **anomalias** e **dicionário de indicadores**
- 💾 **Views salvas** (até 20, nomeadas) e **link compartilhável** que reproduz exatamente os filtros (`#hash`)
- 📤 **Exportações:** CSV (visível) · CSV base completa · Excel (.xls) · PNG do gráfico · Impressão/PDF executiva
- ⚡ Abertura instantânea via **cache stale-while-revalidate**
- 🌗 **Tema claro/escuro** persistente (detecta preferência do sistema)
- ⌨️ Atalhos: `Ctrl+K` buscar dimensão · `/` buscar na tabela · `Ctrl+E` exportar CSV · `Esc` limpar/fechar tudo
- 📱 Responsivo: sidebar vira *drawer* em telas reduzidas

## Integração com Backend

O contrato REST completo (payload, schemas, convenção de sufixos `_fmt/_ant/_var`, erros e passos de integração) está documentado em cada pasta:

- [`glosas-por-convenio/API_CONTRATO.md`](glosas-por-convenio/API_CONTRATO.md)
- [`etapa/API_CONTRATO.md`](etapa/API_CONTRATO.md)
- [`pempfrg/API_CONTRATO.md`](pempfrg/API_CONTRATO.md)

Resumo: alterar em `js/api.service.js`

```js
var USAR_MOCK = false;
var ENDPOINT = '/api/hospital/<dashboard>';
```

## Documentação Completa

📖 Veja **[DOCUMENTACAO.md](DOCUMENTACAO.md)** para a documentação técnica completa: arquitetura, decisões de projeto, especificidades de cada dashboard, agregações, persistência e correções realizadas nesta melhoria.
