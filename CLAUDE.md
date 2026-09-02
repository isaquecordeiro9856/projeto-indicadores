# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Regras de comportamento

- **Responda sempre em português (pt-BR)**, mesmo que o código, os nomes de variáveis/tabelas e os commits estejam em português técnico misturado com inglês.
- **Economize tokens sempre que possível sem sacrificar qualidade**: prefira ler só os trechos de arquivo necessários (grep/offset antes de ler o arquivo inteiro), evite reexplicar o que já foi mostrado, e mantenha respostas objetivas — sem perder precisão técnica nem pular verificação de código.
- **Pergunte em vez de arriscar quando houver dúvida real** (ambiguidade de requisito, múltiplas abordagens válidas, dado que só o usuário sabe) em vez de ficar especulando ou tentando adivinhar silenciosamente.

## Comandos

Não há build step nem bundler — frontend é HTML/CSS/JS servido estático pelo próprio Express. Não há suíte de testes nem linter configurados no repo.

```bash
cd tasy-analytics-backend
npm install
npm run dev      # nodemon (recarrega ao salvar)
npm start        # node src/app.js (produção)
```

Acesse `http://localhost:3000/login.html` (porta vem de `PORT` no `.env`, default 3000). O Express serve o `frontend/` estático e cai em `login.html` para qualquer rota não-API (`app.get('*', ...)`).

`tasy-analytics-backend/.env` (não versionado) precisa de: `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRATION`, `DEV_MODE`. Em `DEV_MODE=true`, qualquer usuário sem perfil cadastrado vira Admin automaticamente (bypass de auth para dev — banco é read-only e o hash de senha do TASY é desconhecido, então não dá pra criar/resetar login real).

**Acesso é restrito a supervisão e direção.** Usuário comum não loga: `authController.login` responde 403 antes de emitir token. Não existe mais código de escopo "dados próprios" — se precisar reabrir acesso para perfis comuns, o ponto de reentrada é o marcador `/* ESCOPO */` das queries (ver abaixo).

## Arquitetura

Monólito de 2 pastas: `tasy-analytics-backend/` (API Node/Express) serve `frontend/` (AngularJS 1.8.2 + Chart.js) como estático — um único processo, uma única porta.

### Backend: 1 módulo = 1 controller = 1 rota = 1 dashboard

Existem 8 módulos de dados espelhados em `routes/`, `controllers/` (não é 1:1 dashboard: `pempfrgController.js` atende 4 dashboards — médico, farmácia, centro cirúrgico, fisioterapia):

| Rota (`/api/...`) | Controller | Dashboard(s) |
|---|---|---|
| `glosas` | `glosasController.js` | financeiro |
| `etapa` | `etapaController.js` | enfermagem |
| `pempfrg` | `pempfrgController.js` | médico, farmácia, centrocirurgico, fisioterapia |
| `farmacia` | `farmaciaController.js` | farmácia |
| `centrocirurgico` | `centrocirurgicoController.js` | centro cirúrgico |
| `fisioterapia` | `fisioterapiaController.js` | fisioterapia |
| `geral` | `geralController.js` | geral (Painel da Direção — cobre todas as fontes) |

Cada controller define um mapa `DIMENSOES_<MODULO>` (ex.: `DIMENSOES_GLOSAS` em `glosasController.js`) — uma entrada por dimensão de análise (convênio, setor, mês, etc.), cada uma com sua própria query SQL bruta contra o schema `ods.*` (não é ORM). O contrato de request usado pelo front (`dimensao`, `indicador`, `tipoPeriodo`, `periodoValor`, `ordem`, `limite`) está descrito em `frontend/js/api.service.js`, que também é a fonte única das dimensões/indicadores válidos por dashboard (não confiar em nenhuma outra lista hardcoded).

**Escopo de acesso é resolvido em runtime** por `services/escopoAcesso.js`: como só supervisão/direção entram no sistema (`config/supervisao.js` — `ehSupervisor`/`ehDirecao`), `aplicarEscopo` apenas remove o marcador `/* ESCOPO */` da query; para qualquer outro usuário substitui por ` AND 1 = 0` (falha fechada, defesa em profundidade). O marcador continua obrigatório no `WHERE` de toda query nova — é o único ponto de reentrada caso o acesso volte a ser aberto para perfis comuns, e sem ele a query perde o `AND 1 = 0`.

RBAC tem só três saídas em `config/permissoes.js` → `resolverPermissao`: `direcao` (6 painéis + `geral`), `supervisor` (6 painéis) e `sem_acesso` (login bloqueado). Não há mais mapa perfil→dashboards nem fallback por setor — supervisão já vê todas as linhas, então restringir a área que ela abre não protegeria nada. `middleware/autorizacao.js` cruza isso com `MODULO_PARA_DASHBOARD`; o Painel Geral usa `exigirDirecao`. Autenticação (`middleware/auth.js`) é JWT simples via header `Authorization: Bearer`.

### Painel Geral (`geralController.js`)

Foge do padrão "1 controller = 1 fonte": cobre todas. O código está em `controllers/geral/` — `indicadores.js` (catálogo único de 148 indicadores + o dicionário `DESCRICOES`), `fontes.js` (23 fontes simples + 5 compostas: métricas SQL + `montar()` com os derivados), `dimensoes.js` (7 áreas → 26 grupos → 157 dimensões) e `consulta.js` (monta/executa as queries).

**Os indicadores disponíveis vêm da fonte da dimensão**, por isso mudam quando a direção troca de dimensão. `construirQuery(dim)` monta o SQL e já injeta o `/* ESCOPO */` — para uma dimensão nova basta declarar `label`/`joins`/`filtro` e a fonte, sem escrever query. `GET /api/geral/catalogo` publica áreas, grupos, dimensões, indicadores, blocos, séries e o dicionário para o front.

**Indicador novo entra com verbete.** O `desc` (e o `formula`, quando for derivado) vai em `DESCRICOES`, no fim de `indicadores.js`, e nunca em `metaIndicador` — ela é chamada ~950 vezes ao montar o catálogo e as descrições duplicadas somariam mais de 100 KB. O front recebe um mapa plano em `catalogo.indicadores` (~24 KB). Um número que a direção não sabe interpretar é pior que um número a menos.

`POST /tendencia` devolve a série mensal de uma dimensão inteira em **uma** query (`consultarDimensao` com `porMes: true, filtrarItem: false`) — não confundir com o `drill` do `POST /`, que é porMes amarrado a um item só. Doze pedidos mensais seriam doze varreduras completas.

**Fonte composta** (com `partes`) cruza duas tabelas: cada parte é consultada na sua própria tabela e as linhas são casadas pelo **rótulo**, porque um join SQL entre duas varreduras de GB sem índice não termina em tempo de tela. É o que dá margem assistencial, conversão em caixa e custo por dia-leito. A dimensão composta declara **um `label` por parte** (com o alias daquele lado) em vez de um `label` só, e `consultarDimensao()`/`consultarTotalDimensao()` escondem a diferença de quem chama. Detalhes e limites em `docs/ARQUITETURA.md`.

**Campo mal preenchido não vira KPI.** Antes de expor uma coluna nova, meça o preenchimento: vários campos do ODS existem e estão vazios nesta base, e o indicador em cima deles mente com cara de fato. Os casos já medidos estão comentados nas fontes (`cd_medico_executor` do repasse em 0,8%, `dt_envio` de protocolo em 4,6%, `qt_permanencia_real` da AIH em 10,5%, `ie_urgencia` do CPOE em 0%).

Armadilhas já resolvidas neste módulo, que valem para qualquer query nova sobre as mesmas tabelas:

- **`ods.procedimento` tem chave composta** (`cd_procedimento`, `ie_origem_proced`) — 26.464 linhas para 21.940 códigos. Juntar só por `cd_procedimento` duplica linhas e infla o valor produzido (medido em 2025: R$ 110,0 mi em vez de R$ 93,7 mi). Os controllers de área (`pempfrg`, `centrocirurgico`, `fisioterapia`) ainda fazem o join incompleto.
- **Nenhuma tabela grande do ODS tem índice de data**, só a PK. Recorte por período varre a tabela inteira: `material_atend_paciente` (3,4 GB) e `cpoe_material` (2,4 GB) levam ~30-40s e são marcadas `pesado: true`.
- **O host do banco tem `/dev/shm` pequeno**: workers paralelos falham com "could not resize shared memory segment". `executar()` refaz a consulta com `SET LOCAL max_parallel_workers_per_gather = 0`.
- **`nota_fiscal` repete a mesma nota nas situações 2 e 3**; a fonte filtra `ie_situacao = '1'` para não dobrar a despesa.

### Frontend: 1 controller Angular para os 6 dashboards (+ 1 separado para o geral)

`frontend/js/dashboard.controller.js` é o único controller Angular (`DashboardController`) usado pelos 6 `dashboard-*.html` — cada página só difere no menu lateral (dimensões/indicadores daquele domain) e nos cards de KPI. `frontend/js/api.service.js` detecta o domain pela URL (`window.location.pathname`) e resolve dinamicamente: endpoint, dimensões válidas, indicadores válidos e config de formatação/cor por indicador — qualquer indicador/dimensão novo tem que ser adicionado nos mapas desse arquivo (`DIMENSOES`, `INDICADORES`, `CONFIG_INDICADORES`) para aparecer no dashboard certo. `frontend/js/dashboard-domain-ui.js` roda antes do Angular bootstrapar e faz o redirect de auth/permissão inicial (evita flash de conteúdo não autorizado) — o controller repete a checagem depois via `AuthService`/`AutorizacaoService` como segunda camada, não é redundância acidental.

`dashboard-geral.html` é um app Angular à parte (`GeralApp` / `js/geral.controller.js`) e **não** usa `api.service.js` nem `dashboard.controller.js`: dimensão, indicador e área nenhum é hardcoded no cliente — tudo vem de `/api/geral/catalogo` e do campo `indicadores` de cada resposta.

A navegação dele é hierarquizada por intenção, em quatro níveis: **busca global** no header (um `<button>` estilizado como campo, que abre a paleta `Ctrl+K` — o índice indicador × dimensão, para quem procura pelo nome do número e não do corte), **abas de área**, **menu lateral** (com nível extra de área na Visão Geral e na busca em todas — sem ele a aba mais simples despejava os 157 cortes numa lista só) e o **explorador**. A Visão Geral tem "Continuar de onde parou" (favoritos + recentes) e "Por onde começar" como pontos de entrada visuais; dentro de uma área, a grade "Ver por…".

A Visão Geral mostra só os blocos que o servidor marca `resumo: true`, e a evolução mensal só é buscada nela. A tendência mensal por corte (`POST /tendencia`) é sempre sob demanda, e em dimensão `pesado` só depois de clique explícito.

Duas armadilhas que valem para qualquer mudança nesse app:

- **Função em `ng-repeat` tem que devolver a mesma referência de array entre digests**, senão dá `$rootScope:infdig`. Por isso `indiceAreas`, `menuSecoes`, `favoritosDim`, `recentesDim`, `areasNavegacao` e `topVariacoes` são campos de escopo pré-computados em `$watch`, não funções de template.
- **`geral.css` tem um contrato JS↔CSS de 10 nomes no topo do arquivo.** Três são lidos por `getComputedStyle` no Chart.js (`--g-texto-3`, `--g-border`, `--g-surface` — que por isso guardam literal de cor, nunca `var()`) e sete são injetados pela diretiva `var-css`. Renomear qualquer um não gera erro no console: a tela só fica errada.

O painel abre com **cache stale-while-revalidate** (`aplicarCacheInicial`): pinta a última resposta salva antes do `/auth/me` e revalida por cima. Gravar sempre dentro do `.then` e **antes** de atribuir ao `$scope` — depois do `ng-repeat` as linhas ganham `$$hashKey` e o cache volta com lixo. Teto de 250 linhas/400 KB por entrada, e purga em `sair()` e na troca de usuário.

Chaves de `localStorage` (tema, filtros salvos, metas, views, cache) são todas escopadas por domain dentro do controller — nunca usar um nome de chave fixo sem o domain no meio, ou uma preferência de um dashboard vaza pra os outros 5.
