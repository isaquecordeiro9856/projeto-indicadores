# Contrato de API — Produção / Faturamento / MatMed (TASY Analytics)

Especificação do endpoint consumido pelo dashboard quando `USAR_MOCK = false`
em `js/api.service.js`.

```
POST /api/hospital/producao-faturamento-matmed
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
| `dimensao`     | string (obrigatório)     | `estabelecimento` \| `setor` \| `tipo_convenio` \| `convenio` \| `tipo_atendimento` \| `medico_executor` \| `paciente` \| `grupo_procedimentos` \| `tipo_procedimentos` \| `procedimentos` \| `grupo_matmed` \| `tipo_matmed` \| `matmed` \| `mes` |
| `indicador`    | string (obrigatório)     | `todos` ou um dos 9 indicadores (ver tabela abaixo)                               |
| `tipoPeriodo`  | string                   | `dia` \| `mes` \| `ano`                                                           |
| `periodoValor` | string/Date/null         | `dia` → ISO date (`YYYY-MM-DD`); `mes` → primeiro dia do mês; `ano` → número; null nos demais |
| `modo`         | string                   | `normal` \| `comparativo`                                                         |
| `ordem`        | string                   | `asc` \| `desc` (o front reordena localmente; campo mantido por compatibilidade)  |
| `limite`       | string                   | `"5"` `"10"` `"25"` `"50"` \| `"todos"` — aplicado server-side                    |
| `rotulo`       | string (opcional)        | Drill-down: restringe a resposta a um único item da dimensão. Com `dimensao: "mes"`, retorna a evolução mensal daquele item (série 12 meses). Campo de extensão — se ignorado pelo backend, o front degrada graciosamente (exibe apenas o snapshot do item). |

### Indicadores aceitos

`qtd_contas`, `qtd_procedimentos`, `qtd_matmed`, `valor_produzido`,
`valor_faturado`, `valor_recebido`, `valor_glosado`, `valor_adicional`,
`valor_medico`

> `taxa_glosa = valor_glosado ÷ valor_faturado × 100` é uma **coluna derivada**
> (não é um indicador selecionável): no modo multivariado deve vir preenchida
> com `_fmt/_ant/_var` como os demais campos.

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
- `valorFormatado`/`valorAnteriorFormatado`: strings pt-BR (BRL ou inteiro).

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

      "qtd_contas": 214,              "qtd_contas_fmt": "214",        "qtd_contas_ant": "...",       "qtd_contas_var": "...",
      "qtd_procedimentos": 1830,      "qtd_procedimentos_fmt": "1.830","qtd_procedimentos_ant": "...","qtd_procedimentos_var": "...",
      "qtd_matmed": 912,              "qtd_matmed_fmt": "912",        "qtd_matmed_ant": "...",       "qtd_matmed_var": "...",

      "valor_produzido": 512400.00,   "valor_produzido_fmt": "R$ 512.400,00",   "valor_produzido_ant": "...",   "valor_produzido_var": "...",
      "valor_faturado": 452300.55,    "valor_faturado_fmt": "R$ 452.300,55",    "valor_faturado_ant": 418900.12,"valor_faturado_var": 7.98,
      "valor_recebido": 430100.00,    "valor_recebido_fmt": "R$ 430.100,00",    "valor_recebido_ant": "...",    "valor_recebido_var": "...",
      "valor_glosado": 22400.00,      "valor_glosado_fmt": "R$ 22.400,00",      "valor_glosado_ant": "...",     "valor_glosado_var": "...",

      "taxa_glosa": 4.95,             "taxa_glosa_fmt": "4,95%",               "taxa_glosa_ant": "...",        "taxa_glosa_var": "...",

      "valor_adicional": 8300.00,     "valor_adicional_fmt": "R$ 8.300,00",     "valor_adicional_ant": "...",   "valor_adicional_var": "...",
      "valor_medico": 158300.00,      "valor_medico_fmt": "R$ 158.300,00",      "valor_medico_ant": "...",      "valor_medico_var": "...",

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

1. Em `pempfrg/js/api.service.js` (referenciado por `pempfrg.html`), alterar:
   ```js
   var USAR_MOCK = false;
   var ENDPOINT = '/api/hospital/producao-faturamento-matmed'; // ajuste se necessário
   ```
2. Garantir que a resposta siga os schemas acima (camelCase, sufixos `_fmt/_ant/_var`).
3. Se os nomes dos campos no TASY divergirem, fazer o mapeamento **no backend**
   (ou inserir uma camada de transformação no `then` do `$http`).
4. `limite` deve ser aplicado server-side; `totalBase` deve refletir o total real.
5. Ordenação padrão (`ordem`) é opcional — o front ordena localmente após receber.
