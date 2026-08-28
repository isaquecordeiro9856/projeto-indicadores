# Contrato de API — Etapa / Tempo de Permanência (TASY Analytics)

Especificação do endpoint consumido pelo dashboard quando `USAR_MOCK = false`
em `js/api.service.js`.

```
POST /api/hospital/etapa-permanencia
Content-Type: application/json
```

---

## Requisição

```json
{
  "dimensao": "etapa",
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
| `dimensao`     | string (obrigatório)     | `conta` \| `convenio` \| `etapa` \| `motivo_devolucao` \| `pessoa_fisica` \| `tipo_atendimento` \| `mes` |
| `indicador`    | string (obrigatório)     | `todos` ou um dos 5 indicadores (ver tabela abaixo)                               |
| `tipoPeriodo`  | string                   | `dia` \| `mes` \| `ano`                                                           |
| `periodoValor` | string/Date/null         | `dia` → ISO date (`YYYY-MM-DD`); `mes` → primeiro dia do mês; `ano` → número; null nos demais |
| `modo`         | string                   | `normal` \| `comparativo`                                                         |
| `ordem`        | string                   | `asc` \| `desc` (o front reordena localmente; campo mantido por compatibilidade)  |
| `limite`       | string                   | `"5"` `"10"` `"25"` `"50"` \| `"todos"` — aplicado server-side                    |
| `rotulo`       | string (opcional)        | Drill-down: restringe a resposta a um único item da dimensão. Com `dimensao: "mes"`, retorna a evolução mensal daquele item (série 12 meses). Campo de extensão — se ignorado pelo backend, o front degrada graciosamente (exibe apenas o snapshot do item). |

### Indicadores aceitos

`qtd_contas`, `dias_etapa`, `media_etapa`, `dias_alta`, `media_alta`

> `media_etapa = dias_etapa ÷ qtd_contas` e `media_alta = dias_alta ÷ qtd_contas`
> são médias decimais em dias (`isDecimal: true`) — agregar por razão, não por média simples.

---

## Resposta — modo individual (`indicador ≠ "todos"`)

```json
{
  "nomeDimensao": "Etapa",
  "nomeIndicador": "Média Etapa",
  "modoTodos": false,
  "isMoeda": false,
  "isPercentual": false,
  "isDecimal": true,
  "color": "#059669",
  "badgeClass": "badge-media-etapa",
  "totalBase": 10,
  "dados": [
    {
      "label": "06 - Internação / Leito Assistencial",
      "valorRaw": 4.3,
      "valorFormatado": "4,30 dias",
      "valorAnteriorRaw": 4.9,
      "valorAnteriorFormatado": "4,90 dias",
      "variacao": -12.24
    }
  ]
}
```

- `isDecimal`: `true` para os indicadores de média — o front exibe "Média Geral" e oculta a coluna Participação.
- `valorAnteriorRaw`, `valorAnteriorFormatado` e `variacao`: presentes **somente**
  quando `modo === "comparativo"`. `variacao` em % ((atual−anterior)/anterior×100).
- `totalBase`: total de registros da base **antes** de aplicar `limite`.

---

## Resposta — modo multivariado (`indicador === "todos"`)

```json
{
  "nomeDimensao": "Etapa",
  "modoTodos": true,
  "totalBase": 10,
  "dados": [
    {
      "label": "06 - Internação / Leito Assistencial",

      "qtd_contas": 182,          "qtd_contas_fmt": "182",
      "qtd_contas_ant": 168,      "qtd_contas_var": 8.33,

      "dias_etapa": 782,          "dias_etapa_fmt": "782",
      "dias_etapa_ant": 823,      "dias_etapa_var": "-4,98",

      "media_etapa": 4.3,         "media_etapa_fmt": "4,30 dias",
      "media_etapa_ant": 4.9,     "media_etapa_var": -12.24,

      "dias_alta": 2101,          "dias_alta_fmt": "2.101",
      "dias_alta_ant": "...",     "dias_alta_var": "...",

      "media_alta": 11.5,         "media_alta_fmt": "11,54 dias",
      "media_alta_ant": "...",    "media_alta_var": "...",

      "valorRawSort": 782
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

1. Em `etapa/js/api.service.js` (referenciado por `Etapa.html`), alterar:
   ```js
   var USAR_MOCK = false;
   var ENDPOINT = '/api/hospital/etapa-permanencia'; // ajuste se necessário
   ```
2. Garantir que a resposta siga os schemas acima (camelCase, sufixos `_fmt/_ant/_var`).
3. Se os nomes dos campos no TASY divergirem, fazer o mapeamento **no backend**
   (ou inserir uma camada de transformação no `then` do `$http`).
4. `limite` deve ser aplicado server-side; `totalBase` deve refletir o total real.
5. Ordenação padrão (`ordem`) é opcional — o front ordena localmente após receber.
