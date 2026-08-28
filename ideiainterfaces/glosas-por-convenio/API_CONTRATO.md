# Contrato de API — Glosas por Convênio (TASY Analytics)

Especificação do endpoint consumido pelo dashboard quando `USAR_MOCK = false`
em `js/api.service.js`.

```
POST /api/hospital/glosas-por-convenio
Content-Type: application/json
```

---

## Requisição

```json
{
  "dimensao": "convenio",
  "indicador": "todos",
  "tipoPeriodo": "mes",
  "periodoValor": "2026-08-01T00:00:00.000Z",
  "modo": "comparativo",
  "ordem": "desc",
  "limite": "10"
}
```

| Campo          | Tipo                     | Valores / Formato                                                                 |
|----------------|--------------------------|-----------------------------------------------------------------------------------|
| `dimensao`     | string (obrigatório)     | `ano` \| `convenio` \| `estabelecimento` \| `mes` \| `mes_referencia` \| `protocolo` \| `sequencia_protocolo` \| `setor` \| `tipo_convenio` \| `tipo_protocolo` |
| `indicador`    | string (obrigatório)     | `todos` ou um dos 12 indicadores (ver tabela abaixo)                              |
| `tipoPeriodo`  | string                   | `dia` \| `mes` \| `ano`                                                           |
| `periodoValor` | string/Date/null         | `dia` → ISO date (`YYYY-MM-DD`); `mes` → primeiro dia do mês; `ano` → número; null nos demais |
| `modo`         | string                   | `normal` \| `comparativo`                                                         |
| `ordem`        | string                   | `asc` \| `desc` (o front reordena localmente; campo mantido por compatibilidade)  |
| `limite`       | string                   | `"5"` `"10"` `"25"` `"50"` \| `"todos"` — aplicado server-side                    |
| `rotulo`       | string (opcional)        | Drill-down: restringe a resposta a um único item da dimensão. Com `dimensao: "mes"`, retorna a evolução mensal daquele item (série 12 meses). Campo de extensão — se ignorado pelo backend, o front degrada graciosamente (exibe apenas o snapshot do item). |

### Indicadores aceitos

`valor_faturado`, `valor_recebido`, `valor_a_receber`, `valor_glosado`,
`valor_glosa_aceita`, `valor_reapresentado`, `valor_adicional`,
`valor_retorno`, `pct_recebido`, `pct_glosado`, `pct_glosa_aceita`,
`pct_adicional`

---

## Resposta — modo individual (`indicador ≠ "todos"`)

```json
{
  "nomeDimensao": "Convênio",
  "nomeIndicador": "Valor Faturado",
  "modoTodos": false,
  "isMoeda": true,
  "isPercentual": false,
  "color": "#2563eb",
  "badgeClass": "badge-val-faturado",
  "totalBase": 14,
  "dados": [
    {
      "label": "Unimed Regional",
      "valorRaw": 452300.55,
      "valorFormatado": "R$ 452.300,55",
      "valorAnteriorRaw": 418900.12,
      "valorAnteriorFormatado": "R$ 418.900,12",
      "variacao": 7.98
    }
  ]
}
```

- `valorAnteriorRaw`, `valorAnteriorFormatado` e `variacao`: presentes **somente**
  quando `modo === "comparativo"`. `variacao` em % ((atual−anterior)/anterior×100).
- `totalBase`: total de registros da base **antes** de aplicar `limite`.
- `valorFormatado`/`valorAnteriorFormatado`: strings pt-BR (BRL ou %).

---

## Resposta — modo multivariado (`indicador === "todos"`)

```json
{
  "nomeDimensao": "Convênio",
  "modoTodos": true,
  "totalBase": 14,
  "dados": [
    {
      "label": "Unimed Regional",

      "valor_faturado": 452300.55,
      "valor_faturado_fmt": "R$ 452.300,55",
      "valor_faturado_ant": 418900.12,
      "valor_faturado_var": 7.98,

      "valor_recebido": 430100.00,  "valor_recebido_fmt": "...",  "valor_recebido_ant": "...",  "valor_recebido_var": "...",
      "valor_a_receber": 15200.00,  "valor_a_receber_fmt": "...", "valor_a_receber_ant": "...", "valor_a_receber_var": "...",
      "valor_glosado": 22400.00,    "valor_glosado_fmt": "...",   "valor_glosado_ant": "...",   "valor_glosado_var": "...",
      "valor_glosa_aceita": 6100.00,"valor_glosa_aceita_fmt": "...","valor_glosa_aceita_ant": "...","valor_glosa_aceita_var": "...",
      "valor_reapresentado": 15100.00,"valor_reapresentado_fmt": "...","valor_reapresentado_ant": "...","valor_reapresentado_var": "...",
      "valor_adicional": 8300.00,   "valor_adicional_fmt": "...", "valor_adicional_ant": "...", "valor_adicional_var": "...",
      "valor_retorno": 11200.00,    "valor_retorno_fmt": "...",   "valor_retorno_ant": "...",   "valor_retorno_var": "...",

      "pct_recebido": 95.1,         "pct_recebido_fmt": "95,1%",  "pct_recebido_ant": "...",    "pct_recebido_var": "...",
      "pct_glosado": 4.95,          "pct_glosado_fmt": "4,95%",   "pct_glosado_ant": "...",     "pct_glosado_var": "...",
      "pct_glosa_aceita": 1.35,     "pct_glosa_aceita_fmt": "...","pct_glosa_aceita_ant": "...","pct_glosa_aceita_var": "...",
      "pct_adicional": 1.83,        "pct_adicional_fmt": "...",   "pct_adicional_ant": "...",   "pct_adicional_var": "...",

      "valorRawSort": 452300.55
    }
  ]
}
```

### Convenção de sufixos

| Sufixo   | Significado                                                              |
|----------|--------------------------------------------------------------------------|
| *(nada)* | Valor numérico bruto do período atual                                    |
| `_fmt`   | String formatada pt-BR para exibição direta                              |
| `_ant`   | Valor numérico do período anterior (**apenas** em `modo: "comparativo"`) |
| `_var`   | Variação % vs. anterior (**apenas** em `modo: "comparativo"`)            |

> Se o backend enviar apenas os valores brutos, o front exibe a tabela sem Δ%
> (os campos são opcionais e tratados com guarda `!= null`). Recomenda-se,
> porém, gerar `_fmt`, `_ant` e `_var` no servidor para bases grandes.

---

## Erros

O service rejeita a promise com mensagem amigável:

```json
{ "mensagem": "Descrição do erro para exibição ao usuário." }
```

- HTTP 4xx/5xx sem body → rejeita com `"Falha na consulta ao servidor (HTTP <status>)."`
- O dashboard exibe o estado de erro com botão "Tentar Novamente".

---

## Passos de integração

1. Em `glosas-por-convenio/js/api.service.js` (referenciado por `glosasporconvenio.html`), alterar:
   ```js
   var USAR_MOCK = false;
   var ENDPOINT = '/api/hospital/glosas-por-convenio'; // ajuste se necessário
   ```
2. Garantir que a resposta siga os schemas acima (camelCase, sufixos `_fmt/_ant/_var`).
3. Se os nomes dos campos no TASY divergirem, fazer o mapeamento **no backend**
   (ou inserir uma camada de transformação no `then` do `$http`).
4. `limite` deve ser aplicado server-side; `totalBase` deve refletir o total real.
5. Ordenação padrão (`ordem`) é opcional — o front ordena localmente após receber.
