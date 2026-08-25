# Documentação Técnica — TASY Analytics (Suíte de Dashboards)

> **Projeto de melhoria das dashboards analíticas do TASY** (sistema de gestão hospitalar).
> Os painéis de **Glosas por Convênio**, **Etapa (Tempo de Permanência)** e **Produção/Faturamento/MatMed (`pempfrg`)** foram **unificados em uma base única de design, estilização e funcionalidades**, herdando todas as evoluções do dashboard mais maduro (Glosas) e mantendo apenas o domínio específico de cada um: dimensões, indicadores, KPIs e metas.

---

## 1. Contexto e Objetivo da Melhoria

As dashboards originais foram construídas como MVPs independentes, em momentos diferentes. Com isso:

- O dashboard de **Glosas** evoluiu e acumulou recursos avançados (views salvas, comparativo YoY, metas, drill-down etc.);
- **Etapa** e **Pempfrg** permaneceram em uma versão anterior: filtros básicos, tabela estática, exportação limitada, sem comparativo YoY, sem metas, sem evolução temporal, sem drill-down;
- Cada um tinha pequenas divergências de layout, ícones, comportamento e persistência.

**Esta melhoria:**

1. Tomou o Glosas como **referência canônica** de UI/UX e engenharia;
2. Portou sua estrutura integral para Etapa e Pempfrg (**HTML, CSS e JS idênticos entre os 3**);
3. Substituiu apenas o **domínio**: dimensões, indicadores, KPIs, fórmulas, metas, dicionário e textos;
4. Corrigiu bugs herdados (ex.: painel Dicionário que fechava imediatamente ao abrir).

Resultado: manutenção centralizada (uma correção replicável nos 3), experiência idêntica para o usuário em qualquer painel e integração backend padronizada via contrato único.

### Antes × Depois

| Recurso | Versão anterior (Etapa/Pempfrg) | Após a melhoria (padrão nos 3) |
|---|---|---|
| Modos de visão | Atual · Comparativo | + **Comparativo YoY** (mesmo período do ano anterior) |
| Metas executivas | ❌ | ✅ Semáforo configurável + conformidade |
| Views salvas | ❌ | ✅ Até 20 visões nomeadas |
| Link compartilhável | ❌ | ✅ `#hash` reproduz filtros |
| Evolução temporal 12m | ❌ | ✅ Linha mensal + tracejado ano anterior |
| Drill-down por item | ❌ | ✅ Modal com KPIs + série mensal |
| Colunas configuráveis | ❌ (tabela fixa) | ✅ Painel de colunas persistido |
| Anomalias | ❌ | ✅ Destaque de Δ% ≥ limiar |
| Dicionário | ❌ | ✅ Explicação de cada indicador |
| Exportações | CSV/Excel/Copiar | + **CSV base completa** · **PNG** · Impressão PDF |
| CDN | versões soltas | **SRI hash** (integridade) |
| Cache inicial | ❌ | ✅ stale-while-revalidate |
| KPIs clicáveis | ❌ | ✅ Focam o indicador na sidebar |
| Acessibilidade teclado | parcial | ✅ Enter/Espaço em todos os itens (`ng-keydown`) |

---

## 2. Arquitetura

Frontend **100% estático, sem build step**. Cada pasta é autossuficiente.

```
┌────────────────────────────────────────────────────────┐
│ <dashboard>.html        View (AngularJS directives)    │
│   ├── ng-app="DashboardApp"  ng-controller="DashboardController"
│   └── carrega js/api.service.js → js/dashboard.controller.js
├────────────────────────────────────────────────────────┤
│ js/api.service.js       Fonte de dados                 │
│   • USAR_MOCK=true  → mock determinístico (demo)      │
│   • USAR_MOCK=false → $http.post(ENDPOINT)             │
│   • Suporta drill-down ("rotulo") e fator por período  │
├────────────────────────────────────────────────────────┤
│ js/dashboard.controller.js   Todo o comportamento      │
│   • estado/filtros/persistência · watchers · requests  │
│   • KPIs · metas · anomalias · variações · views/hash  │
│   • renderização Chart.js (principal/secundário/       │
│     tendência/drill) · exportações · atalhos           │
├────────────────────────────────────────────────────────┤
│ css/styles.css          Tema claro/escuro completo     │
└────────────────────────────────────────────────────────┘
```

**Dependências (CDN com SRI):**
- AngularJS `1.8.2`
- Chart.js `4.4.9` (UMD)
- Google Fonts: Inter (300–800) + JetBrains Mono (500/600)

---

## 3. Padrão Visual Unificado (layout)

Todos os 3 painéis seguem exatamente a mesma estrutura de tela:

1. **Sidebar retrátil** — marca, busca (`Ctrl+K`), seção 1 *Dimensão Analisada* (agrupada), seção 2 *Métricas/Indicadores* (com dot colorido por indicador), atalhos de teclado no rodapé; vira *drawer* com backdrop ≤ 940px.
2. **Header superior** — toggle sidebar, Período (dia/mês/ano com inputs condicionais), presets, Visão (Atual/Comparativo/YoY), Ordenação, Exibir (Top 5/10/25/50/Todos); à direita: tema, compartilhar link, **Views**, Copiar, **Exportar** (dropdown), Imprimir PDF.
3. **Period banner** — badge do período atual, "vs" período comparado e meta-informações da resposta.
4. **Barra de Metas** (modo multivariado) — chips semáforo + botão de configuração.
5. **KPI grid** — 5 cards clicáveis (multivariado) ou cards contextuais (indicador individual).
6. **Card Maiores Variações** (somente em comparativo/YoY) — colunas Altas/Quedas com clique-para-localizar.
7. **Card Análise Gráfica** — Barras Horizontais / Colunas / Participação (%) (individual), pills de séries, botão inverter ordenação, gráfico secundário no modo comparativo individual.
8. **Card Evolução Temporal** — seletor de ano + pills de séries; linha tracejada = ano anterior.
9. **Card Detalhamento Analítico** — toolbar (busca `/`, colunas, anomalias, dicionário), tabela individual ou multivariada dinâmica com Δ% nas células, tfoot de totais, linhas com drill-down.
10. **Sumário Comparativo** (rodapé, modo comparativo) — valores atual × anterior × variação.
11. **Modais** — nomear view salva; drill-down do item.
12. **Toast flutuante** — feedback de ações (sucesso/erro/info).

Estados transversais: spinner de carregamento, erro com "Tentar Novamente", estado vazio.

---

## 4. Funcionalidades — Detalhamento Técnico

### 4.1 Filtros, períodos e presets
- `filtrosTop`: `tipoPeriodo` (dia/mês/ano), `dataDia`/`dataMes` (objetos Date — exigência do AngularJS para `input[type=date/month]`), `dataAno`, `ordem`, `limite`, `modoVisao`.
- Presets (`aplicarPreset`) setam os filtros; detecção de preset ativo é **dinâmica** (`isPresetAtivo` compara filtros ↔ definição, não flag manual).
- Rótulos precisos (`atualizarRotulosPeriodo`): "Mês Anterior", "(Mesmo Mês do Ano Passado)" no YoY etc.

### 4.2 Comparativo YoY (client-side)
O contrato REST só aceita `modo: normal|comparativo`. No YoY:
1. Busca o período atual normalmente;
2. Busca o mesmo período deslocado −1 ano (`deslocarPeriodoAnos`) com `limite:'todos'`;
3. `mesclarComparativoYoy()` casa itens por label normalizado (sem acentos/caixa) e produz os mesmos campos `_ant/_variacao` que o backend geraria — **a UI não sabe que é YoY**.

### 4.3 Ordenação Top-N real
Com Top-N ativo, ordenar por qualquer coluna busca os **extremos verdadeiros da base completa** (`baseCompletaDados`, obtida em segundo plano quando `totalBase > dados.length`), e não apenas reordena o recorte exibido (`reconstruirExibicao`). Ordenação de 3 estados nos títulos: desc → asc → neutro.

### 4.4 Metas executivas
- `METAS_PADRAO` por dashboard (seção 6) + persistência e restauração;
- `metaStatus(chave)` compara `kpis.nums[chave]` contra meta (`max|min`);
- Chip de **conformidade**: nº de itens dentro da meta principal;
- Classificação visual em 3 níveis respeitando a meta (`badge-glosa-baixa/media/alta` no pempfrg).

### 4.5 Anomalias e Maiores Variações
- Limiar padrão **25%** (`limiarAnomalia`), persistido; só atua em comparativo/YoY;
- Multivariado: item anômalo se **qualquer coluna visível** tiver `|Δ%| ≥ limiar`; badge ⚠ na linha;
- Painel de variações usa a métrica selecionada no dropdown (respeita `inverterDelta` para colorir favorável/desfavorável);
- `focarLinhaTabela(label)` limpa busca se necessário, rola até a linha e destaca por 2,4s.

### 4.6 Evolução Temporal e Drill-down
- Tendência: payload `dimensao:'mes'`, ano selecionável; no comparativo/YoY inclui série do ano −1 **tracejada**;
- Drill-down: payload com `rotulo: <item>` — extensão do contrato; se indisponível, degrada graciosamente ("Série mensal indisponível");
- Tokens anti-race (`tokenTendencia`, `tokenDrill`) garantem que só a resposta mais recente pinta a tela.

### 4.7 Tabela multivariada dinâmica
- Colunas definidas em `definicaoColunas` (key, rótulo, badgeClass, `inverterDelta`);
- Visibilidade por usuário (`colunasVisiveis` + localStorage);
- Células: valor formatado colorido por `.ind-<key>` + Δ% inline (`classeDelta`) verde/vermelho conforme favorável;
- Totais do rodapé agregam por **soma** (valores) ou **razão** (percentuais/médias) — nunca média simples de razões.

### 4.8 Views salvas + link compartilhável
- `capturarEstadoVisao/aplicarEstadoVisao`: dimensão, indicador, período, modo, ordem, limite (validados contra listas canônicas);
- Hash params: `#d=&i=&tp=&dd=&dm=&da=&mv=&o=&l=` — sincronizado via `history.replaceState` e aplicado na carga (`parseHashEstado` tem prioridade sobre o estado salvo);
- Botão "Copiar link desta visão" (clipboard API com fallback `execCommand`).

### 4.9 Exportações
| Formato | Origem | Observações |
|---|---|---|
| CSV (visível) | `respostaBackend.dados` | BOM UTF-8, separador `;`, decimais `,` |
| CSV completo | nova consulta `limite:'todos'` | ignora Top-N |
| Excel .xls | tabela HTML embutida (MSO XML) | sem dependências externas |
| PNG | `chart.toBase64Image('image/png', 1)` | gráfico principal |
| Impressão/PDF | CSS `@media print` + cabeçalho exclusivo | `Ctrl+P` |

### 4.10 Performance e robustez
- **Cache stale-while-revalidate:** última resposta gravada por assinatura de payload; na abertura pinta instantâneo com toast "Exibindo consulta salva de …" enquanto revalida;
- Debounce de 150ms nos watchers; token anti-race por tipo de requisição;
- Altura do gráfico calculada por nº de itens (`calcularAlturaContainer`: 65px/barra multivariado, 34px individual, mín. 380px);
- Plugin custom `rotulosBarras` desenha o valor no fim de cada barra (modo individual);
- `fecharMenusFlutuantes()` centraliza fechamento (clique-fora, Esc, ações).

### 4.11 Responsividade de gráficos (resize/zoom)
- **Re-render com debounce (250ms)** em `window.resize`, `orientationchange` e via **`ResizeObserver`** no container `.dashboard-scroll` — cobre zoom do navegador, rotação de dispositivo, toggle da sidebar e qualquer mudança interna de largura que o Chart.js não percebe sozinho (evita canvas com tamanho "congelado"/borrado);
- Fallback por polling de largura (400ms) para navegadores sem ResizeObserver;
- Travas CSS contra *grid blowout*: `.chart-scroll-wrapper`/`.chart-container-inner`/`.charts-grid > div` com `min-width: 0; max-width: 100%`;
- `header-right` quebra linha em telas estreitas; dropdowns limitados a `calc(100vw - 24px)`; `height: 100dvh` no body para barras dinâmicas de mobile;
- Breakpoint extra em **1100px**: o comparativo lado a lado vira coluna única antes de apertar demais.

### 4.12 Acessibilidade & i18n
- Itens de menu com `role="button" tabindex="0"` + `ativarTecla` (Enter/Espaço);
- `aria-label`/`title` nos controles; foco visível;
- Todo o conteúdo em pt-BR, formatação numérica pt-BR.

---

## 5. Modelo de Dados e Contrato

Requisição POST (`API_CONTRATO.md` de cada pasta):

```json
{ "dimensao": "...", "indicador": "todos|<chave>", "tipoPeriodo": "dia|mes|ano",
  "periodoValor": Date|número|null, "modo": "normal|comparativo",
  "ordem": "asc|desc", "limite": "5|10|25|50|todos", "rotulo": "(opcional)" }
```

Resposta — convenção de sufixos por campo de indicador:

| Sufixo | Significado |
|---|---|
| *(nada)* | valor numérico bruto do período |
| `_fmt` | string formatada pt-BR para exibição direta |
| `_ant` | valor do período anterior (somente `comparativo`) |
| `_var` | variação % vs. anterior (somente `comparativo`) |

Metadados: `nomeDimensao`, `nomeIndicador`, `modoTodos`, `isMoeda`, `isPercentual` (+`isDecimal` na etapa), `color`, `badgeClass`, `totalBase`, `dados[]`.

Mock determinístico: seeds derivadas do label/índice/período — mesmos filtros produzem sempre os mesmos números (bom para demo e testes visuais).

---

## 6. Especificidades por Dashboard

### 6.1 Glosas por Convênio (`glosas-por-convenio/`)
- **Dimensões (10):** Ano, Mês, Mês de Referência, Estabelecimento, Setor, Convênio, Tipo Convênio, Tipo de Protocolo, Protocolo, Sequência do Protocolo.
- **Indicadores (12):** Valor Faturado / Recebido / a Receber / Glosado / Glosa Aceita / Reapresentado / Adicional / Retorno (R$); % Recebido / % Glosado / % Glosa Aceita / % Adicional.
- **KPIs:** Faturamento (sub: a receber) · Recebido (% adimplência; sub: retorno) · Glosas (badge semáforo da taxa; sub: glosa aceita) · Reapresentação (sub: adicional) · A Receber Líquido.
- **Metas padrão:** Glosa ≤ 4% · Aceita ≤ 1,5% · Recebido ≥ 95% · Adicional ≥ 2%.
- **Séries:** Todos · Financeiro (R$) · Percentuais (%) · Glosas vs Recuperação — **eixos duplos R$ (base/topo) × % (topo/direita)**.
- **Δ% invertido** (aumento = ruim) em glosado/glosa aceita/% glosado/% glosa aceita.
- Mock: relações coerentes (recebido deriva de faturado−glosado+retorno+adicional; a receber = residual ≥ 0).

### 6.2 Etapa — Tempo de Permanência (`etapa/`)
- **Dimensões (6 + mês interno):** Conta (gerada dinamicamente), Convênio, Etapa, Motivo devolução, Pessoa física, Tipo atendimento.
- **Indicadores (5):** Qtde Contas · Dias Etapa · Média Etapa *(decimal)* · Dias Alta · Média Alta *(decimal)*.
- **KPIs:** Dias Etapa (sub: média) · Média Etapa (dias/conta) · Dias Alta (sub: média alta) · Média Alta · Qtde Contas.
- **Metas padrão:** Média Etapa ≤ 4 dias · Média Alta ≤ 12 dias — conformidade conta itens com média de etapa dentro da meta.
- **Agregações especiais:** totais de médias são **por razão** (`Σdias ÷ Σcontas`), nunca média de médias; indicador decimal exibe "Média Geral", oculta Participação e formata "X,X dias"; variação **invertida** (queda de tempo = verde).
- **Séries:** Todos · Etapa (Dias & Média) · Até a Alta (Dias & Média) · Volume de Contas — **eixo único numérico**.
- Gráficos/tabelas/drill usam formatação decimal-aware (tooltips de média com 1–2 casas).

### 6.3 Produção / Faturamento / MatMed (`pempfrg/`)
- **Dimensões (13 + mês interno):** Estabelecimento, Setor, Tipo Convênio, Convênio, Tipo Atendimento, Médico Executor, Paciente, Grupo/Tipo/Procedimentos, Grupo/Tipo MatMed, MatMed.
- **Indicadores (9 + derivada):** Qtd. Contas · Qtd. Proc./Exames · Qtd. Mat./Med. · Val. Produzido · Val. Faturado · Val. Recebido · Val. Glosado · Val. Adicional · Repasse Médico; **`% Glosa` = Glosado ÷ Faturado** (coluna derivada com dot semáforo e `inverterDelta`).
- **KPIs:** Faturamento (sub: produzido) · Recebido (% adimplência) · Glosas (badge semáforo vs. meta) · Volumetria & Ticket Médio (fat ÷ contas) · Repasse Médico (% do faturado).
- **Metas padrão:** Taxa Glosa ≤ 5% · Recebido ≥ 90%.
- **Séries:** Todos · Financeiro (R$) · Quantidades · Fat × Glosa × Recebido — **eixos duplos R$ × Quantidades**.
- Mock coerente: produção ≥ faturado; recebido = faturado − glosado + adicional·0,6; repasse 25–45% do faturado.

---

## 7. Persistência (localStorage)

Chaves namespaced por dashboard (`glosas_ / etapa_ / pempfrg_`):

| Chave (`<prefix>_dashboard_*`) | Conteúdo |
|---|---|
| `estado_v1` | dimensão, indicador, filtros de período, ordem, limite, tipo de gráfico, série ativa |
| `colunas_v1` | visibilidade das colunas multivariadas |
| `tema_v1` | tema claro/escuro |
| `metas_v1` | valores de meta editados |
| `anomalia_v1` | toggle + limiar de anomalia |
| `views_v1` | até 20 visões salvas (nome, descrição, estado) |
| `cache_v1` | última resposta (assinatura de payload + timestamp) |

Validações: listas canônicas `DIMENSOES_VALIDAS`/`INDICADORES_VALIDOS`/`MODOS_VISAO_VALIDOS` impedem restauração corrompida; datas são serializadas ISO e reidratadas como `Date`.

---

## 8. Decisões e Convenções de Implementação

- **Objetos (não primitivos) no scope** para modelos ligados a `ng-model` sob `ng-if` (ex.: `tendenciaAno.valor`, `novaView.nome`, `painelVarMetrica.metrica`) — evita *shadowing* no escopo-filho do AngularJS.
- **`alternarPainel(nome, forcar)`** alterna flags de painéis sempre no escopo do controller (atribuição inline em `ng-click` criaria cópia sombreada).
- **`inverterDelta`** na definição da coluna define se aumento é desfavorável — usado pelo Δ% da célula, painel de variações e cores do KPI.
- **Tokens anti-race** (`tokenRequisicao/tokenTendencia/tokenDrill`) descartam respostas defasadas.
- **Handler global de clique-fora** fecha dropdowns; containers protegidos: `.exportar-dropdown`, `.colunas-dropdown`, `.views-dropdown`, `.metas-bar`, **`.btn-dicionario`/`.dicionario-panel`**.
- **SRI** nos CDNs; fontes com `preconnect`.
- Cores por indicador centralizadas: variáveis CSS `--color-*` (claro+escuro), classes `.ind-*` (números da tabela), `badge-*`, paleta escura espelhada no controller (`PALETA_ESCURA_INDICADORES`).
- Nomes de arquivo de exportação: `Tasy_<Dashboard>_<dimensao>[_completo]_<data>.csv/.xls/.png`.

---

## 9. Correções Realizadas Nesta Melhoria

1. **Dicionário não abria** (bug presente inclusive no glosas original): o clique borbulhava até o handler global de "clique fora", que fechava o painel logo após o `ng-click` abri-lo. Corrigido excluindo `.btn-dicionario`/`.dicionario-panel` do fechamento automático nos 3 dashboards.
2. **Gráficos "bugavam" de tamanho em zoom/redimensionamento**: agora há re-render com debounce via `resize`/`orientationchange`/`ResizeObserver` (seção 4.11) e travas CSS de largura nos wrappers dos gráficos.
3. **Item Líder mostrava errado** com ordenação crescente — líder agora vem da base completa, não da ordenação vigente.
4. **Totais/KPIs refletiam só o Top-N** — passaram a usar a base completa buscada em background.
5. **Eixos misturando unidades** resolvidos por família de séries (R$ × Quantidades na pempfrg; eixo único numérico na etapa).
6. Padronização de comentários/textos e remoção de resquícios de domínio trocado entre dashboards.

---

## 10. Como Estender

### Adicionar uma dimensão (qualquer dashboard)
1. `api.service.js`: incluir lista em `basesDeDados` + nome em `nomesDimensao`;
2. Controller: adicionar à `DIMENSOES_VALIDAS`;
3. HTML: novo `<li class="menu-item">` na sidebar (com `role/tabindex/ng-keydown`).

### Adicionar um indicador
1. `api.service.js`: entrada em `configIndicadores` (flags `isMoeda/isPercentual/isDecimal`, cor, badge) + geração no mock (atual, `_ant`, `_var`);
2. Controller: `INDICADORES_VALIDOS`, `definicaoColunas` (com `inverterDelta` se aumento for ruim), totais/KPIs, dicionário, exportações (CSV/Excel/copiar);
3. CSS: variáveis `--color-*` (claro/escuro), `.badge-*`, `.ind-*`, `::before` do card;
4. HTML: item da sidebar, card KPI (se aplicável), pill de série (opcional).

### Criar um 4º dashboard
Copiar uma pasta existente → trocar domínio (dimensões/indicadores/KPIs/metas/séries/dicionário/textos) → renomear chaves `<nome>_dashboard_*` → ajustar `ENDPOINT` e `API_CONTRATO.md`. Design e funcionalidades vêm de graça.

---

## 11. Limitações Conhecidas / Roadmap Sugestões

- Comparativo YoY depende de casamento exato de rótulos entre anos (labels devem ser estáveis);
- Drill-down mensal exige suporte a `rotulo` no backend (mock já implementa; real pode degradar graciosamente);
- Excel exporta a tabela filtrada atual (não a base completa);
- Possíveis próximos passos: alertas automáticos de anomalia (e-mail/Teams), exportação agendada, autenticação/SSO, paginação virtual para bases muito grandes, testes automatizados (unitários no controller e E2E).
