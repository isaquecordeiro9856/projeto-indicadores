# Contrato da API

Todas as rotas de dados (exceto `/api/auth` e `/api/health`) exigem header `Authorization: Bearer <token>` e retornam 401 se ausente/inválido/expirado, ou 403 se o perfil não tem acesso ao dashboard do módulo.

## Autenticação

### `POST /api/auth/login`

```json
{ "nm_usuario": "string", "ds_senha": "string" }
```

Resposta 200:
```json
{
  "token": "jwt",
  "usuario": { "nm_usuario", "ds_usuario", "cd_perfil_inicial", "cd_setor_atendimento", "cd_estabelecimento" },
  "perfil": { "descricao", "nivel", "dashboards": [...], "exportar", "configurar", "supervisor", "direcao", "escopo" }
}
```

Responde **403** (`"Acesso restrito à supervisão e à direção..."`) para quem não é supervisor nem direção — nenhum token é emitido. `nivel` é `direcao` | `supervisor`.

Em `DEV_MODE=true`, qualquer senha é aceita para um `nm_usuario` existente em `ods.usuario`; se o usuário não tiver perfil, recebe automaticamente Admin (`cd_perfil_inicial = 1848`), que é perfil de direção.

### `GET /api/auth/me`

Retorna `{ usuario, perfil }` a partir do token decodificado (sem nova consulta ao banco). Também responde 403 se o token perdeu o acesso depois de emitido (perfil saiu das listas de supervisão).

## Módulos de dados

Rotas: `POST /api/glosas`, `/api/etapa`, `/api/pempfrg`, `/api/farmacia`, `/api/centrocirurgico`, `/api/fisioterapia`.

### Request

```json
{
  "dimensao": "convenio",
  "indicador": "valor_faturado",
  "tipoPeriodo": "mes",
  "periodoValor": "2026-08-01",
  "ordem": "desc",
  "limite": 10,
  "dashboard": "financeiro"
}
```

| Campo | Obrigatório | Descrição |
|---|---|---|
| `dimensao` | sim | chave do mapa `DIMENSOES_<MODULO>` do controller — 400 se inválida |
| `indicador` | não | `"todos"` (default) retorna todos os indicadores da dimensão; um indicador específico retorna só ele, ordenado |
| `tipoPeriodo` | não | `dia` \| `mes` \| `ano`; ausente = sem filtro de período |
| `periodoValor` | não | data (`YYYY-MM-DD`) ou ano puro (`2026`) quando `tipoPeriodo = 'ano'` |
| `ordem` | não | `asc` \| `desc` (default `desc`) |
| `limite` | não | inteiro > 0, default 999 (`obterLimite` em `utils/periodo.js`) |
| `dashboard` | condicional | necessário para módulos multi-dashboard (`pempfrg`); valida contra `MODULO_PARA_DASHBOARD` |

A lista de `dimensao`/`indicador` válidos **por dashboard** (não por módulo) é definida em `frontend/js/api.service.js` (`DIMENSOES`, `INDICADORES`) — é a fonte única de verdade consultada pelo front antes de montar o request. O backend valida independentemente contra o mapa `DIMENSOES_<MODULO>` do próprio controller.

### Response — modo `indicador = "todos"`

```json
{
  "nomeDimensao": "Convênio",
  "modoTodos": true,
  "totalBase": 42,
  "dados": [
    { "label": "...", "valor_faturado": 0, "valor_faturado_fmt": "R$ 0,00", "...": "..." }
  ]
}
```

### Response — indicador específico

```json
{
  "nomeDimensao": "Convênio",
  "nomeIndicador": "Valor Faturado",
  "modoTodos": false,
  "isMoeda": true,
  "isPercentual": false,
  "color": "#2563eb",
  "badgeClass": "badge-val-faturado",
  "totalBase": 42,
  "dados": [ { "label": "...", "valorRaw": 0, "valorFormatado": "R$ 0,00" } ]
}
```

`totalBase` é o total de linhas antes do `limite` (paginação client-side não existe — o front usa `totalBase` para exibir "mostrando N de M").

### Erros

| Status | Motivo |
|---|---|
| 400 | dimensão ou indicador inválido para o módulo |
| 401 | token ausente, inválido ou expirado |
| 403 | perfil sem acesso ao dashboard do módulo, ou `dashboard` inválido para o módulo |
| 500 | erro de query/servidor |

## Painel Geral (direção)

Rotas `/api/geral/*`, todas exigindo `perfil.direcao === true` (middleware `exigirDirecao`) — supervisor comum recebe **403**. Respostas ficam 15 min em cache (as demais rotas usam 1 min): nenhuma tabela grande do ODS tem índice de data, então todo recorte por período varre a tabela.

O painel cobre 28 fontes do ODS (23 simples + 5 compostas, sobre 25 tabelas) em 157 dimensões, 26 grupos e 7 áreas, com 148 indicadores. É a fonte da dimensão que define quais indicadores existem — por isso a lista muda a cada dimensão.

### `GET /api/geral/catalogo`

Menu completo. É a **fonte única** de áreas, dimensões, indicadores, blocos e séries — o front não guarda nenhuma lista.

```json
{
  "anoAtual": "2026",
  "totalDimensoes": 157,
  "totalIndicadores": 148,
  "areas": [
    { "id": "assistencial", "nome": "Assistencial", "icone": "◉", "cor": "#0d9488",
      "descricao": "Atendimentos, ocupação, produção, cirurgia e diagnósticos" }
  ],
  "grupos": [
    {
      "nome": "Atendimentos", "area": "assistencial", "icone": "◉", "cor": "#4a3aa7",
      "descricao": "Volume, desfecho, óbito, convênio e perfil dos pacientes",
      "dimensoes": [
        {
          "id": "atend_faixa_etaria", "nome": "Faixa Etária", "grupo": "Atendimentos",
          "area": "assistencial", "evolucao": false, "ordemFixa": true,
          "pesado": false, "composta": false,
          "indicadorPadrao": "qtd_atendimentos",
          "indicadores": [ { "chave", "nome", "tipo", "cor", "melhor" } ]
        }
      ]
    }
  ],
  "blocos": [ { "chave": "financeiro", "titulo": "Financeiro — Glosas", "icone": "$",
                "area": "financeiro", "resumo": true, "pesado": false,
                "indicadores": ["valor_faturado", "..."] } ],
  "series": [ { "chave": "valor_faturado", "nome": "Faturado", "tipo": "moeda", "cor": "#2a78d6" } ],
  "indicadores": {
    "pct_glosado": { "nome": "% Glosado", "tipo": "percentual", "melhor": "menor",
                     "desc": "Quanto do faturado o convênio recusou…",
                     "formula": "glosado ÷ faturado × 100" }
  }
}
```

| Campo | Significado |
|---|---|
| `tipo` | `moeda` \| `inteiro` \| `decimal` \| `percentual` \| `dias` \| `horas` |
| `melhor` | `maior` (crescer é bom) \| `menor` (crescer é ruim) \| `neutro` — define a cor do delta |
| `area` | aba do painel em que a dimensão/bloco aparece (`geral`, `financeiro`, `assistencial`, `sus`, `suprimentos`, `apoio`, `resultado`) |
| `evolucao` | dimensão mensal: varre o ano inteiro mesmo com filtro de mês |
| `ordemFixa` | ordem de leitura declarada (faixa etária, prioridade, status), não ordenável |
| `pesado` | fonte grande sem índice de data: a consulta leva dezenas de segundos |
| `composta` | dimensão que cruza duas fontes: cada lado é consultado na sua tabela e as linhas são casadas pelo rótulo (ver `docs/ARQUITETURA.md`) |
| `resumo` | bloco que também aparece na aba Visão Geral (8 dos 28) |

`origemDados`/`fontes` de cada dimensão **não** vêm no catálogo: eles chegam na resposta de cada consulta, que é onde a tela os usa. Mandá-los aqui dobrava o payload (449 KB contra 160 KB).

`indicadores` é o **dicionário**: um mapa plano chave → verbete, com uma entrada por indicador (~24 KB). Ele existe como mapa, e não repetido dentro de cada dimensão, porque `metaIndicador` é chamado ~950 vezes ao montar o catálogo — as descrições duplicadas somariam mais de 100 KB. É o que alimenta o painel "Dicionário" e a linha "O que é" do popover ⓘ.

### `POST /api/geral`

```json
{ "dimensao": "prod_convenio", "indicador": "valor_produzido", "ordem": "desc",
  "limite": 25, "tipoPeriodo": "ano", "periodoValor": "2025",
  "comparar": true, "drill": null }
```

| Campo | Efeito |
|---|---|
| `indicador` | inválido para a dimensão **não** dá 400: cai no `indicadorPadrao` da fonte (a resposta diz qual foi usado) |
| `comparar` | traz o mesmo recorte no período anterior (mês → mês anterior; ano → ano anterior) com `_ant` e `_var` por indicador. Ignorado em dimensões de evolução |
| `drill` | rótulo de um item: devolve a **evolução mensal** só daquele item, em vez da dimensão |

Sem `tipoPeriodo`, assume o ano corrente inteiro.

Resposta 200 — cada linha traz **todos** os indicadores da fonte, crus e formatados, mais o indicador ativo em `valorRaw`/`valorFormatado`:

```json
{
  "dimensao": "prod_convenio", "nomeDimensao": "Convênio", "grupo": "Produção",
  "evolucao": false, "drill": null, "pesado": false, "composta": false,
  "fontes": ["ods.procedimento_paciente", "ods.convenio"],
  "origemDados": { "tabelas": ["..."], "campos": { "valor_produzido": "pp.vl_procedimento" },
                   "filtro": "pp.dt_procedimento >= $1 AND pp.dt_procedimento < $2" },
  "indicador": "valor_produzido", "nomeIndicador": "Valor Produzido",
  "tipo": "moeda", "cor": "#1baf7a", "melhor": "maior",
  "indicadores": [ { "chave", "nome", "tipo", "cor", "melhor" } ],
  "naoAditivos": ["qtd_atendimentos", "ticket_atendimento", "proc_por_atend"],
  "comparado": true,
  "periodo": { "ano": "2025", "mes": null, "rotulo": "2025", "rotuloAnterior": "2024" },
  "totalBase": 44, "truncado": false, "limiteFonte": null,
  "totais": { "valor_produzido": 0, "valor_produzido_fmt": "R$ 0,00",
              "valor_produzido_ant": 0, "valor_produzido_var": 11.0 },
  "dados": [
    { "label": "SUS", "valor_produzido": 0, "valor_produzido_fmt": "R$ 0,00",
      "valor_produzido_ant": 0, "valor_produzido_ant_fmt": "R$ 0,00", "valor_produzido_var": 17.2,
      "valorRaw": 0, "valorFormatado": "R$ 0,00", "variacao": 17.2, "novo": false }
  ]
}
```

Pontos que mudam a leitura dos números:

- **`totais`** é o consolidado de **todas** as linhas da base, não só as exibidas: soma as colunas cruas e recalcula os derivados só no fim (a média dos percentuais linha a linha não é o percentual do consolidado).
- **`truncado: true`** indica dimensão de cardinalidade alta: o banco devolveu apenas as `limiteFonte` maiores linhas, e o total veio de uma agregação separada sobre a base inteira.
- **`naoAditivos`** lista contagens `DISTINCT` (e derivados delas). Somá-las entre grupos superestima — o mesmo atendimento aparece em mais de uma linha —, então vêm no total com o prefixo `≈`.
- **`novo: true`** marca linha que não existia no período anterior (sem base de comparação; `_var` vem `null`).
- **`composta: true`** avisa que os números vêm de duas tabelas casadas pelo rótulo. Rótulo presente num lado e ausente no outro entra com zero do lado que falta, e os dois lados não são o mesmo evento no tempo — é por isso que `% Faturado que Entrou` passa de 100% em meses em que o caixa quitou fatura anterior.

### `POST /api/geral/resumo`

```json
{ "bloco": "atendimento", "comparar": true, "tipoPeriodo": "ano", "periodoValor": "2025" }
```

Três formas de pedir:

| Corpo | Devolve |
|---|---|
| `{ "bloco": "atendimento" }` | só aquele bloco (é assim que o painel pede, **um por requisição, em paralelo**, pintando cada cartão conforme chega — um pedido único prenderia a tela na fonte mais lenta) |
| `{ "area": "sus" }` | todos os blocos não pesados daquela área |
| sem `bloco` nem `area` | os blocos `resumo` não pesados — o que a aba Visão Geral mostra |

`{ "pesados": true }` inclui os blocos pesados no pedido por `area`/resumo.

```json
{
  "periodo": { "ano": "2025", "mes": null, "rotulo": "2025", "rotuloAnterior": "2024" },
  "blocos": [
    { "chave": "atendimento", "titulo": "Atendimentos e Desfechos", "icone": "◉",
      "area": "assistencial", "resumo": true, "pesado": false, "composta": false,
      "fontes": ["ods.atendimento_paciente", "..."],
      "kpis": [ { "chave", "nome", "tipo", "cor", "melhor", "valor", "valorFormatado",
                  "valorAnterior", "valorAnteriorFormatado", "variacao" } ] }
  ]
}
```

Blocos por área:

| Área | Blocos |
|---|---|
| `financeiro` | `financeiro`, `retorno`, `recebimento`, `contas`, `guias`, `protocolos`, `contabil` |
| `assistencial` | `atendimento`, `ocupacao`, `producao`, `cirurgico`, `fisioterapia`, `diagnosticos` |
| `sus` | `sus_aih`, `sus_apac`, `sus_laudos`, `repasse` |
| `suprimentos` | `compras`, `nutricao` e — `pesado` — `custo`, `farmacia`, `exames`, `prescricao` |
| `apoio` | `manutencao` |
| `resultado` | `res_caixa`, `res_prod_conta` e — `pesado` — `res_margem`, `res_custo_int` |

Marcados `resumo` (a Visão Geral): `financeiro`, `recebimento`, `atendimento`, `ocupacao`, `producao`, `sus_aih`, `res_caixa` e `custo` (esse último pesado, então entra só quando pedido).

### `POST /api/geral/evolucao`

Mesmo formato de período. Sempre cobre o ano inteiro, mesmo com filtro de mês, e casa séries de fontes diferentes num eixo único de meses.

```json
{
  "ano": "2025",
  "meses": ["2025-01", "..."],
  "series": [ { "chave", "nome", "tipo", "cor", "dados": [0], "formatados": ["R$ 0,00"] } ]
}
```

### `POST /api/geral/tendencia`

Série mensal de **uma dimensão inteira** — o total do corte mês a mês, não de um item (isso é o `drill` de `POST /api/geral`).

```json
{ "dimensao": "prod_convenio", "indicador": "valor_produzido", "ano": "2025", "comparar": false }
```

Sempre o ano inteiro: `tipoPeriodo`/`periodoValor` não se aplicam aqui. `comparar: true` acrescenta `anterior` com o mesmo recorte do ano anterior — é uma **segunda varredura da tabela**, por isso o painel só manda quando a pessoa pede.

```json
{
  "dimensao": "prod_convenio", "nomeDimensao": "Convênio", "ano": 2025,
  "indicador": "valor_produzido", "nomeIndicador": "Valor Produzido",
  "tipo": "moeda", "cor": "#1baf7a", "melhor": "maior",
  "indicadores": [ { "chave", "nome", "tipo", "cor", "melhor" } ],
  "pesado": false, "composta": false,
  "totais": { "valor_produzido": 0, "valor_produzido_fmt": "R$ 0,00" },
  "dados": [ { "label": "2025-01", "valor_produzido": 0, "valor_produzido_fmt": "R$ 0,00" } ],
  "anterior": null
}
```

Internamente é `consultarDimensao(dim, …, { porMes: true, filtrarItem: false })`: **uma** query agrupada por mês. Doze requisições mensais seriam doze varreduras completas (6 a 8 min numa fonte pesada) e nem aproveitariam o cache, já que cada corpo é uma chave diferente. Por isso o painel carrega a tendência só sob demanda e, em dimensão `pesado`, só depois de clique explícito.

### Erros específicos do painel

| Status | Motivo |
|---|---|
| 400 | `dimensao` ou `bloco` inexistente |
| 403 | perfil sem `direcao` |
| 500 | erro de query. O caso conhecido — *"could not resize shared memory segment"*, do `/dev/shm` pequeno do host — é tratado antes: `executar()` refaz a consulta sem paralelismo |

## `GET /api/health`

Sem autenticação. Roda `SELECT NOW()` no banco; retorna `{ status: 'ok', timestamp }` ou 500.
