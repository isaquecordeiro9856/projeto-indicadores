# Adaptação Total do Frontend por Role — TASY Analytics

## Objetivo

Adaptar cada dashboard do frontend para exibir **somente as dimensões, indicadores e métricas reais do backend** para o role correspondente, eliminando itens fictícios ou genéricos herdados do protótipo. O frontend deve ser **totalmente funcional**, integrado com o banco PostgreSQL via backend Node.js existente.

---

## Diagnóstico do Estado Atual

### Problema Central
Os dashboards HTML foram copiados do protótipo `ideiainterfaces/` com dimensões e indicadores **genéricos/fictícios** que não existem no backend. O `dashboard-domain-ui.js` tenta filtrar esses itens, mas a abordagem é frágil — itens ocultos via `hidden` ainda existem no DOM.

### O que Existe no Backend (real) por Dashboard

| Dashboard | API Endpoint | Dimensões Reais | Indicadores Reais |
|---|---|---|---|
| `dashboard-medico.html` | `/api/pempfrg` | convenio, setor, medico_executor, procedimento, mes | qtd_contas, qtd_procedimentos, valor_produzido, valor_medico |
| `dashboard-financeiro.html` | `/api/glosas` | convenio, estabelecimento, setor, tipo_convenio, tipo_protocolo, mes | valor_faturado, valor_recebido, valor_glosado, valor_glosa_aceita, valor_reapresentado, valor_adicional, valor_retorno + % |
| `dashboard-enfermagem.html` | `/api/etapa` | convenio, estabelecimento, motivo_devolucao, mes | qtd_contas, dias_etapa, media_etapa, vl_conta |
| `dashboard-farmacia.html` | `/api/farmacia` | material, setor, mes, antibiotico | qtd_prescricoes, qtd_pacientes, qtd_materiais |
| `dashboard-centrocirurgico.html` | `/api/centrocirurgico` | procedimento, convenio, setor, medico, porte, mes | qtd_contas, qtd_procedimentos, valor_produzido |
| `dashboard-fisioterapia.html` | `/api/fisioterapia` | procedimento, convenio, setor, medico, mes | qtd_contas, qtd_atendimentos, valor_produzido, valor_medico |

---

## Proposed Changes

### Estratégia: Controller Universal + HTMLs Limpos

Criar **1 controller universal** (`dashboard.controller.js`) que detecta o domain pela URL e usa o endpoint correto — reduz manutenção e elimina duplicação de 300k+ linhas.

---

### Componente 1: JavaScript — Controller Universal

#### [NEW] [dashboard.controller.js](file:///c:/Users/icordeiro/Documents/projetoindicadores/frontend/js/dashboard.controller.js)

- Detecta domain por URL (medico/financeiro/enfermagem/farmacia/centrocirurgico/fisioterapia)
- Usa dimensões/indicadores corretos por domain
- Conecta com a API real (sem mock)
- Mantém toda a lógica de KPIs, gráficos, tabela, exportação, tema e filtros

---

### Componente 2: JavaScript — API Service

#### [MODIFY] [api.service.js](file:///c:/Users/icordeiro/Documents/projetoindicadores/frontend/js/api.service.js)

- Suportar todos os 6 endpoints detectando o domain pela URL
- Eliminar aliases confusos entre dimensões inexistentes
- Mapear corretamente parâmetros de período para cada endpoint

---

### Componente 3: HTML — Dashboard Médico

#### [MODIFY] [dashboard-medico.html](file:///c:/Users/icordeiro/Documents/projetoindicadores/frontend/dashboard-medico.html)

Sidebar com **somente** dimensões e indicadores reais do `/api/pempfrg`:
- **Dimensões**: Convênio, Setor, Médico Executor, Procedimento, Mês
- **Indicadores**: Qtde Atendimentos, Qtde Procedimentos, Valor Produzido, Valor Repasse Médico
- **Remove**: tipo_atendimento, grupo_matmed, tipo_matmed, matmed, paciente, tipo_convenio

---

### Componente 4: HTML — Dashboard Financeiro

#### [MODIFY] [dashboard-financeiro.html](file:///c:/Users/icordeiro/Documents/projetoindicadores/frontend/dashboard-financeiro.html)

Sidebar com **somente** dimensões e indicadores reais do `/api/glosas`:
- **Dimensões**: Convênio, Estabelecimento, Setor, Tipo Convênio, Tipo Protocolo, Mês
- **Indicadores**: Valor Faturado, Valor Recebido, Valor a Receber, Valor Glosado, Glosa Aceita, Reapresentado, Adicional, Retorno, todos os % derivados
- **Remove**: ano, mes_referencia, protocolo, sequencia_protocolo

---

### Componente 5: HTML — Dashboard Enfermagem

#### [MODIFY] [dashboard-enfermagem.html](file:///c:/Users/icordeiro/Documents/projetoindicadores/frontend/dashboard-enfermagem.html)

Sidebar com **somente** dimensões e indicadores reais do `/api/etapa`:
- **Dimensões**: Convênio, Estabelecimento, Motivo Devolução, Mês
- **Indicadores**: Qtde Contas, Dias Etapa, Média Etapa, Valor Conta

---

### Componente 6: HTML — Dashboard Farmácia

#### [MODIFY] [dashboard-farmacia.html](file:///c:/Users/icordeiro/Documents/projetoindicadores/frontend/dashboard-farmacia.html)

Sidebar com **somente** dimensões e indicadores reais do `/api/farmacia`:
- **Dimensões**: Material/Medicamento, Setor, Mês, Tipo (Antibiótico)
- **Indicadores**: Prescrições, Pacientes, Materiais distintos
- **Remove**: estabelecimento, tipo_convenio, convenio

---

### Componente 7: HTML — Dashboard Centro Cirúrgico

#### [MODIFY] [dashboard-centrocirurgico.html](file:///c:/Users/icordeiro/Documents/projetoindicadores/frontend/dashboard-centrocirurgico.html)

Sidebar com **somente** dimensões e indicadores reais do `/api/centrocirurgico`:
- **Dimensões**: Procedimento Cirúrgico, Convênio, Setor, Médico, Porte Cirúrgico, Mês
- **Indicadores**: Atendimentos, Procedimentos, Valor Produzido

---

### Componente 8: HTML — Dashboard Fisioterapia

#### [MODIFY] [dashboard-fisioterapia.html](file:///c:/Users/icordeiro/Documents/projetoindicadores/frontend/dashboard-fisioterapia.html)

Sidebar com **somente** dimensões e indicadores reais do `/api/fisioterapia`:
- **Dimensões**: Procedimento, Convênio, Setor, Profissional, Mês
- **Indicadores**: Atendimentos, Atend. Fisio, Valor Produzido, Valor Profissional

---

### Componente 9: JavaScript — dashboard-domain-ui.js simplificado

#### [MODIFY] [dashboard-domain-ui.js](file:///c:/Users/icordeiro/Documents/projetoindicadores/frontend/js/dashboard-domain-ui.js)

Com HTMLs limpos, o arquivo se torna apenas:
- Verificação de autenticação (redirect → login.html)
- Verificação de autorização (redirect → hub.html)
- Aplicação de título/tag correto ao brand por domain

---

## User Review Required

> [!IMPORTANT]
> **Arquitetura de controllers**: O plano cria `dashboard.controller.js` unificado e os 3 controllers originais ficam intactos como backup. Os HTMLs passarão a carregar o novo controller. Confirma essa abordagem?

> [!IMPORTANT]
> **KPIs com metas**: Os controllers originais possuem metas hardcoded (ex: % recebido = 85%). Quer manter essas metas por domain no novo controller ou remover por agora?

> [!NOTE]
> **Execução**: Após as mudanças, iniciarei o backend e abrirei o browser para validação visual ao vivo.

---

## Verification Plan

### Automated Tests
```bash
# Iniciar o backend
cd tasy-analytics-backend && npm run dev

# Health check
curl http://localhost:3000/api/health

# Testar endpoint médico
curl -X POST http://localhost:3000/api/pempfrg -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"dimensao":"convenio","indicador":"todos","tipoPeriodo":"mes"}'
```

### Manual Verification
- Login → Hub mostra apenas dashboards autorizados pelo perfil
- Em cada dashboard: cada dimensão real carrega dados do banco
- Sem itens ghost no DOM
- Tema escuro/claro, exportação CSV funcionando
