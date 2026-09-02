# Arquitetura

Monólito de 2 pastas: `tasy-analytics-backend/` (API Node/Express) serve `frontend/` (AngularJS 1.8.2 + Chart.js) como estático — um único processo, uma única porta. Não há build step nem bundler: o front é HTML/CSS/JS puro.

```
projetoindicadores/
├── tasy-analytics-backend/
│   └── src/
│       ├── app.js              # bootstrap Express, monta rotas e serve frontend/ estático
│       ├── config/
│       │   ├── database.js     # pool PostgreSQL
│       │   ├── permissoes.js   # RBAC: só supervisão (6 painéis) e direção (+ painel geral)
│       │   └── supervisao.js   # quem é supervisor e quem é direção (perfil/login/setor)
│       ├── controllers/        # 1 controller = 1 rota = 1 módulo de dados
│       ├── middleware/         # auth.js (JWT), autorizacao.js (RBAC), rateLimiter.js
│       ├── routes/             # 1 rota REST por controller
│       ├── services/
│       │   ├── escopoAcesso.js # resolve o marcador /* ESCOPO */ das queries
│       │   └── usuarioService.js
│       └── utils/
│           ├── periodo.js      # tipoPeriodo/periodoValor → anoRef/mesRef
│           └── formatar.js
└── frontend/
    ├── login.html
    ├── hub.html
    ├── dashboard-{financeiro,enfermagem,medico,farmacia,centrocirurgico,fisioterapia}.html
    ├── dashboard-geral.html            # painel da direção (app Angular próprio)
    ├── css/common.css, css/geral.css
    └── js/
        ├── auth.service.js            # login, token, logout
        ├── autorizacao.service.js     # checagem de acesso a dashboard (2ª camada)
        ├── dashboard-domain-ui.js     # roda antes do Angular bootstrapar; evita flash de conteúdo não autorizado
        ├── api.service.js             # fonte única de dimensões/indicadores válidos por dashboard
        ├── dashboard.controller.js    # único controller Angular, usado pelos 6 dashboards
        ├── geral.controller.js        # controller do painel geral (não usa api.service.js)
        └── dashboard-utils.service.js
```

## Backend: 1 módulo = 1 controller = 1 rota = 1 dashboard (quase)

| Rota (`/api/...`) | Controller | Dashboard(s) atendido(s) |
|---|---|---|
| `glosas` | `glosasController.js` | financeiro |
| `etapa` | `etapaController.js` | enfermagem |
| `pempfrg` | `pempfrgController.js` | médico, farmácia, centrocirurgico, fisioterapia |
| `farmacia` | `farmaciaController.js` | farmácia |
| `centrocirurgico` | `centrocirurgicoController.js` | centro cirúrgico |
| `fisioterapia` | `fisioterapiaController.js` | fisioterapia |
| `geral` | `geralController.js` | geral (Painel da Direção) |

`pempfrgController.js` não é 1:1 com um dashboard — é reaproveitado por 4 dashboards diferentes.

`geralController.js` também foge do padrão, na direção oposta: em vez de uma fonte de dados, ele cobre **todas**. Por isso mora numa pasta própria:

```
controllers/
├── geralController.js      # rotas: catálogo, dados, resumo por bloco, evolução
│                           # + BLOCOS (28 cartões de KPI, com área) e SERIES (12)
└── geral/
    ├── indicadores.js      # catálogo único de 148 indicadores (nome, tipo, cor, direção) + DESCRICOES
    ├── fontes.js           # 23 fontes simples + 5 compostas (FROM/WHERE/métricas/derivados)
    ├── dimensoes.js        # 7 áreas → 26 grupos → 157 dimensões (rótulo + joins)
    └── consulta.js         # monta e executa as queries; período, comparativo e composição
```

A estrutura é `FONTES` × `DIMENSOES`, organizada em três níveis de navegação: **área** (a aba: Visão Geral, Financeiro, Assistencial, SUS, Suprimentos & Custos, Apoio & Infra, Resultado) → **grupo** → **dimensão**. Cada **fonte** é uma tabela-base do ODS com suas métricas cruas e a função `montar()` que calcula os derivados; cada **dimensão** é só um rótulo SQL + joins apontando para uma fonte. Como é a fonte que declara os indicadores, **os indicadores disponíveis mudam conforme a dimensão escolhida**.

Nenhuma query é escrita à mão: `construirQuery(dim)` monta o SQL e já injeta o `/* ESCOPO */` no lugar certo. Para acrescentar uma dimensão basta declarar `label`/`joins`/`filtro` e a fonte — ela aparece sozinha na aba da área, no menu, na busca global, no drill-down, na exportação e no comparativo.

### Fontes compostas (indicadores que cruzam duas tabelas)

Uma fonte com `partes` não tem `from`/`where`/`metricas` próprios: ela declara duas fontes e um prefixo para cada (`a_`, `b_`), e a dimensão declara **um rótulo por parte**, com o alias daquele lado. Cada parte é consultada na sua própria tabela, com o seu período e o seu escopo, e as linhas voltam casadas pelo **rótulo** — é assim que sai margem assistencial (produção − custo de material), conversão em caixa (recebido ÷ faturado) e custo por dia-leito.

Por que casar por rótulo e não por join SQL: as tabelas envolvidas somam gigabytes e nenhuma tem índice de data, então um join entre duas varreduras completas não termina em tempo de tela. `consultarDimensao()` esconde a diferença — quem chama recebe `{ rows }` nos dois casos.

O que isso **não** garante: rótulo presente num lado e ausente no outro entra com zero do lado que falta, e os dois lados não são o mesmo evento no tempo (o caixa de junho pode quitar fatura de maio, e é por isso que `% Faturado que Entrou` passa de 100% em alguns meses). Só declare dimensão composta onde os dois lados falam do mesmo universo — convênio e setor quando as duas tabelas apontam para `ods.convenio`/`ods.setor_atendimento`, e mês sempre. A tela marca essas dimensões com `×2` e explica isso no *tooltip*.

Quatro detalhes que valem saber antes de mexer:

- **`topSql`** corta o top N no banco em dimensões de cardinalidade alta (materiais, procedimentos, pessoas). Nesses casos o total da tabela sai de uma agregação separada, sem `GROUP BY`, senão o TOTAL seria a soma só das linhas exibidas.
- **`naoAditivos`** lista indicadores de contagem `DISTINCT` (e derivados) que não podem ser somados entre grupos; eles saem no total com o prefixo `≈`.
- **Fallback serial**: o host do banco tem `/dev/shm` pequeno e os workers paralelos do Postgres falham com *"could not resize shared memory segment"*. `executar()` detecta esse erro e refaz a consulta numa transação com `SET LOCAL max_parallel_workers_per_gather = 0`.
- **Campo mal preenchido não vira KPI.** Vários campos do ODS existem mas estão vazios na base desta casa, e um indicador em cima deles mente com cara de fato. Os casos já medidos e as decisões estão comentados nas próprias fontes: `cd_medico_executor` do repasse (0,8% preenchido → não há corte por médico), `dt_envio` de protocolo (4,6% → o fluxo é medido por `ie_status_protocolo`), `qt_permanencia_real` da AIH (10,5% → a média sai sobre as AIH que têm o campo, e a contagem fica ao lado), `ie_urgencia` do CPOE (0 marcações → sem indicador de urgência), `vl_participante` da guia e `vl_juros`/`vl_coparticipacao` do retorno (zerados).

Cada controller define um mapa `DIMENSOES_<MODULO>` (ex. `DIMENSOES_GLOSAS`) com uma entrada por dimensão de análise (convênio, setor, mês, etc.), cada uma com sua própria query SQL bruta contra o schema `ods.*` (sem ORM). O contrato de request (`dimensao`, `indicador`, `tipoPeriodo`, `periodoValor`, `ordem`, `limite`) é documentado em [API.md](API.md).

`utils/periodo.js` converte `tipoPeriodo` (`dia`/`mes`/`ano`) + `periodoValor` em `anoRef`/`mesRef`, usados nos filtros `WHERE` das queries. Datas são formatadas com getters locais (não `toISOString`) porque UTC-3 joga a data um dia para trás.

## Escopo de acesso (linha a linha)

Ver [SEGURANCA.md](SEGURANCA.md) para o detalhamento completo de RBAC + escopo de dados.

## Frontend: 1 controller Angular para os 6 dashboards (+ 1 para o painel geral)

`dashboard.controller.js` é o único controller Angular (`DashboardController`), usado pelos 6 `dashboard-*.html` — cada página difere apenas no menu lateral (dimensões/indicadores daquele domain) e nos cards de KPI.

`api.service.js` detecta o domain pela URL (`window.location.pathname`) e resolve dinamicamente:
- endpoint (`ENDPOINTS`)
- dimensões válidas (`DIMENSOES`)
- indicadores válidos (`INDICADORES`)
- formatação/cor por indicador (`CONFIG_INDICADORES`)

Qualquer indicador ou dimensão novo **tem que** ser adicionado nesses mapas para aparecer no dashboard certo — não existe outra lista hardcoded confiável no front.

`dashboard-domain-ui.js` roda antes do Angular bootstrapar e faz o redirect de auth/permissão inicial (evita flash de conteúdo não autorizado). O controller repete a checagem depois via `AuthService`/`AutorizacaoService` como segunda camada — não é redundância acidental, é defesa em profundidade no cliente (a autorização real acontece no backend).

`dashboard-geral.html` é um app Angular separado (`GeralApp` / `geral.controller.js`) e **não** usa `api.service.js` nem `dashboard.controller.js`: nada de dimensão, indicador ou área é hardcoded no cliente. Tudo vem de `GET /api/geral/catalogo` e cada resposta de `POST /api/geral` traz de novo a lista de indicadores válidos daquela dimensão — dimensão nova no backend aparece sozinha na tela.

### Navegação: quatro níveis, por intenção

A direção não procura da mesma forma sempre, e o problema nunca foi ter vários caminhos — foi eles disputarem o mesmo nível visual. A hierarquia é por **intenção**:

| Nível | Onde | Serve a quem |
|---|---|---|
| **N0 Busca global** | barra no header (`.busca-global`) → paleta `Ctrl+K` | sabe o nome do **número** ("valor glosado", "custo por internação") |
| **N1 Abas de área** | `.abas-area`, `1…9` ou ←/→ | sabe o **assunto** |
| **N2 Menu lateral** | área → grupo → corte | quer **varrer** o que existe |
| **N3 Explorador** | chips de indicador, gráfico, tabela | quer **analisar** |

- A barra do header é um `<button>` estilizado como campo: parece campo (é achável para quem procura com os olhos) e é botão (não duplica componente nem `ng-model`). Digitar nela abre a paleta já semeada com a letra.
- A paleta busca sobre o índice **indicador × dimensão** (~1.150 pares) montado no cliente a partir de `grupos`. Casa termo a termo e sem acento, então "glosa convenio" acha. Com o campo vazio ela mostra **sugestões clicáveis** (recentes, ou uma por área) em vez de pedir que a pessoa adivinhe.
- O menu tem **três formatos de seção** (`menuSecoes`): `fixa` (★ Favoritos, ↻ Recentes), `area` (nível extra) e `grupo` (lista rasa). O nível de área existe porque a Visão Geral não tem cortes próprios: sem ele, a aba mais simples do painel despejava os 157 cortes das 7 áreas numa lista só.
- Na Visão Geral, **"Continuar de onde parou"** (favoritos + recentes) e **"Por onde começar"** (um cartão por área com cortes sugeridos) são os pontos de entrada visuais. Sugerido = primeira dimensão não-pesada de cada grupo: a ordem em `dimensoes.js` já é editorial, então isso dá cobertura em largura sem inventar ranking nem tocar no backend.
- Dentro de uma área, a grade **"Ver por…"** mostra todos os cortes daquele assunto de uma vez, agrupados.

### Cuidados específicos desse app

- Os blocos do resumo são pedidos **um a um em paralelo** (`POST /api/geral/resumo` com `bloco`), cada um com seu esqueleto de carregamento. Um pedido único prenderia a tela na fonte mais lenta (a farmácia sozinha leva ~30s).
- A **Visão Geral** mostra apenas os blocos que o servidor marca com `resumo: true` (8 dos 28). Sem esse filtro a tela de abertura teria ~110 KPIs. Mesmo assim são ~41 números: o que os hierarquiza é o **KPI primário** (o 1º indicador de cada bloco ocupa a linha inteira, via `.kpis .kpi:first-child` — CSS puro), a **cauda rebaixada** (do 5º em diante vira par nome/valor sem caixa) e a faixa **"O que mudou"** com as 4 maiores variações de todos os blocos.
- **Sinal de atenção no KPI: no máximo um canal por cartão**, com prioridade meta > delta. Delta ruim vira borda esquerda vermelha; meta configurada vira um ponto antes do valor. Anomalia **não** entra aqui de propósito: `/resumo` devolve um escalar por indicador, e sem distribuição não há desvio-padrão a calcular — o sinal seria inventado.
- A **evolução mensal só é buscada na Visão Geral** — são 8 varreduras em paralelo que ninguém veria nas outras abas. Fora dela o pedido fica pendente (`evolucaoPendente`) e é feito quando a aba volta a ser aberta.
- A **tendência mensal por corte** (`POST /api/geral/tendencia`) é sempre **uma** query agrupada por mês e sempre **sob demanda**; em dimensão `pesado` só depois de clique explícito. Doze pedidos mensais seriam doze varreduras completas. O ano anterior tracejado é opt-in porque custa uma segunda varredura.
- Cores de área, grupo e indicador chegam como custom properties CSS (`--area-cor`, `--dim-cor`, `--chip-cor`). `ng-style` **não** serve para isso: o jqLite faz `element.style[nome] = valor`, que ignora `--var`. Por isso existe a diretiva `var-css`, que usa `style.setProperty`.
- Funções chamadas dentro de `ng-repeat` **têm que** devolver a mesma referência de array entre digests. Por isso `indiceAreas`, `menuSecoes`, `favoritosDim`, `recentesDim`, `areasNavegacao` e `topVariacoes` são campos de escopo pré-computados em `$watch`, e não funções de template. Devolver um `filter()` novo a cada chamada dispara `$rootScope:infdig`.
- O `geral.css` tem no topo um bloco de **contrato JS↔CSS** com 10 nomes que não podem ser renomeados: três lidos por `getComputedStyle` no Chart.js (`--g-texto-3`, `--g-border`, `--g-surface` — que por isso guardam literal de cor, nunca `var()`) e os sete injetados pela `var-css`. Quebrá-los não gera erro no console; a tela só fica errada.

O catálogo é grande (157 dimensões × indicadores), então `montarCatalogo()` deixa `origemDados`/`fontes` de fora de cada dimensão — a tela lê esses metadados só na resposta de cada consulta, e mandá-los no catálogo dobrava o payload (449 KB contra 160 KB). O **dicionário** (`catalogo.indicadores`) segue a mesma lógica pelo lado oposto: é um mapa plano de 148 entradas (~24 KB) em vez de a descrição repetida nas ~950 combinações do catálogo.

### Cache stale-while-revalidate

A abertura do painel esperava 30-40s de tela vazia. Agora `aplicarCacheInicial()` pinta a última resposta salva antes mesmo do `/auth/me` e revalida por cima, com a faixa `.faixa-cache` avisando (não um toast: a revalidação leva mais tempo do que um toast fica na tela). Regras que sustentam isso:

- `VERSAO_CACHE` acompanha o `?v=` dos assets: deploy invalida tudo. Mais um TTL absoluto de 24h.
- Aplicado **uma vez, no boot**. A resposta real sempre sobrescreve; o cache nunca sobrescreve resposta.
- Gravar dentro do `.then`, **antes** de atribuir ao `$scope`: depois que o `ng-repeat` roda, o Angular carimba `$$hashKey` nas linhas e o cache voltaria com lixo que pode virar `ngRepeat:dupes`.
- Teto de 250 linhas e ~400 KB por entrada: 999 linhas comparadas de uma fonte com 14 indicadores dão ~3,5 MB, e o orçamento de ~5 MB da origem é dividido com os caches dos 6 painéis de área. Em `QuotaExceededError`, purga só as chaves `cache_*` (nunca as preferências) e tenta uma vez.
- O painel cobre o hospital inteiro, então o cache é purgado em `sair()` e quando o `nm_usuario` do `/auth/me` difere do gravado.

### Preferências e acessibilidade

As preferências (tema, visões, metas, favoritos, recentes, colunas, densidade, escopo do menu, áreas recolhidas, atalhos de uma tecla, **área ativa**) ficam em `localStorage` sob o prefixo `tasy_geral_`, separado do `tasy_dashboard_<domain>` usado pelos painéis de área. O deep link no hash carrega `area` além de `dim`/`ind`/período, e visão salva antiga (sem `area`) cai na área do próprio corte.

Decisões de acessibilidade que valem registrar porque não são óbvias:

- As abas são um `tablist` com **roving tabindex** — a faixa inteira é um único stop de Tab e as setas andam entre elas.
- A paleta é **combobox + listbox**: o foco fica no input o tempo todo e quem "anda" é o `aria-activedescendant`. Os itens são `div role="option"` e não `<button>`, porque botão dentro de listbox quebra a árvore acessível. Ao fechar, o foco volta para quem a abriu.
- Os `<th>` ordenáveis têm `tabindex="0"` e `ng-keydown`: com `ng-click` puro, ordenar a tabela era impossível sem mouse.
- Os atalhos de uma tecla (`b t c e p r a d`) colidem com a navegação rápida de leitor de tela (b = botão, t = tabela, d = landmark) e podem ser desligados no painel de atalhos; `Ctrl+K`, `/` e `Esc` seguem ativos. O handler global também **ignora eventos com Ctrl/Meta/Alt** — sem isso ele engolia Ctrl+R, Ctrl+P e Ctrl+D do navegador.
- `--g-texto-3` é `#626e87` (5,12:1 no branco). Não clarear: além de rótulo de KPI e header de tabela, é a cor dos eixos do Chart.js.

Chaves de `localStorage` (tema, filtros salvos, metas, views, cache) são todas escopadas por domain dentro do controller — nunca usar uma chave fixa sem o domain no meio, ou uma preferência de um dashboard vaza para os outros 5.

## Stack

- **Backend**: Node.js + Express + `pg` (PostgreSQL), `jsonwebtoken`, `helmet`, `cors`, `express-rate-limit`
- **Frontend**: AngularJS 1.8.2 + Chart.js 4.4.9, sem build step
- **Banco**: PostgreSQL, schema `ods.*` (réplica do TASY, somente leitura)
- **Auth**: JWT simples via header `Authorization: Bearer`
