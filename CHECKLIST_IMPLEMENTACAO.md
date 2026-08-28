# Checklist de Implementação — TASY Analytics
## RBAC + Dashboards por Perfil com Dados Reais

> Documento de acompanhamento do progresso. Marque `[x]` quando concluído.

> **IMPORTANTE**: A pasta `ideiainterfaces` é apenas referência de design. Os dashboards reais são criados do zero para cada perfil.

---

## FASE 1 — Backend Base ✅

- [x] Criar `tasy-analytics-backend/` com package.json, .env, .gitignore
- [x] Criar `src/config/database.js` (pool PostgreSQL)
- [x] Criar `src/config/permissoes.js` (mapeamento de 16 perfis)
- [x] Criar `src/app.js` (Express server)
- [x] `npm install` — 126 pacotes instalados
- [x] `GET /api/health` retorna status ok

---

## FASE 2 — Autenticação ✅

- [x] Criar `src/services/usuarioService.js` (buscarPorLogin, validarCredenciais)
- [x] Criar `src/services/resetSenha.js` (reset temporário para testes)
- [x] Criar `src/controllers/authController.js` (login, me, resetSenhaTemp)
- [x] Criar `src/middleware/auth.js` (validação JWT)
- [x] Criar `src/middleware/autorizacao.js` (verificação de permissão)
- [x] Criar `src/routes/auth.js` (POST /login, GET /me, POST /reset-senha)
- [x] DEV_MODE=true bypass (senha não validada, perfil 1848 automático)

---

## FASE 3 — Endpoints de Dados ✅

- [x] Criar `src/utils/formatar.js` (formatação pt-BR)
- [x] Criar `src/utils/periodo.js` (extração de período — strings paraanoRef/mesRef)
- [x] Criar `src/controllers/glosasController.js` (6 dimensões: convenio, estabelecimento, setor, tipo_convenio, tipo_protocolo, mes)
- [x] Criar `src/controllers/etapaController.js` (4 dimensões: convenio, estabelecimento, motivo_devolucao, mes — usa cd_convenio_parametro)
- [x] Criar `src/controllers/pempfrgController.js` (5 dimensões: convenio, setor, medico_executor, procedimento, mes — usa procedimento_paciente)
- [x] Criar `src/controllers/farmaciaController.js` (4 dimensões: material, setor, mes, antibiotico — cpoe_material + JOIN material)
- [x] Criar `src/controllers/centrocirurgicoController.js` (6 dimensões: procedimento, convenio, setor, medico, porte, mes — filtra ie_tiss_tipo_guia='7')
- [x] Criar `src/controllers/fisioterapiaController.js` (5 dimensões: procedimento, convenio, setor, medico, mes — filtra ds_procedimento ILIKE '%fisio%')
- [x] Criar `src/routes/glosas.js`, `etapa.js`, `pempfrg.js`, `farmacia.js`, `centrocirurgico.js`, `fisioterapia.js`

---

## FASE 4 — Testes Backend ✅

### Login
- [x] DEV_MODE: login sem validação de senha → retorna token
- [x] Perfil 1848 (Admin) atribuído automaticamente para teste
- [x] Credenciais teste: isaque / dhfxop90

### Endpoints de Dados
- [x] POST /api/glosas com dimensãoconvenio → 27 rows (jul/2026)
- [x] POST /api/glosas com dimensão mes → 12 rows
- [x] POST /api/etapa com dimensãoconvenio → 33 rows
- [x] POST /api/etapa com dimensão mes → 12 rows
- [x] POST /api/pempfrg com dimensãoconvenio → 34 rows
- [x] POST /api/pempfrg com dimensão procedimento → 1928 rows
- [x] POST /api/pempfrg com dimensão mes → 12 rows
- [x] POST /api/farmacia com dimensão material → 3 rows (jul/2026)
- [x] POST /api/farmacia com dimensão mes → 5 rows
- [x] POST /api/centrocirurgico com dimensão procedimento → 3 rows (jul/2026)
- [x] POST /api/centrocirurgico com dimensão mes → 5 rows
- [x] POST /api/fisioterapia com dimensão procedimento → 3 rows (jul/2026)
- [x] POST /api/fisioterapia com dimensão mes → 5 rows

---

## FASE 5 — Análise do Banco ✅

### Mapeamento de Tabelas/Colunas
- [x] `glosas_protocolos` — faturado, recebido, glosado, adicional, retorno, reapresentado (7 tipos glosa)
- [x] `glosas_por_item` — vl_total_conta, vl_pago_convenio, vl_glosa_item (sem dados aug/2026)
- [x] `procedimento_paciente` — vl_procedimento, vl_medico, dt_procedimento, cd_convenio, cd_setor_atendimento, cd_medico, ie_tiss_tipo_guia
- [x] `cpoe_material` — cd_material, dt_liberacao, ie_item_valido, ie_antibiotico, cd_setor_atendimento (SEM nome/valor — JOIN com material)
- [x] `fat_rec_item` — **TABELA VAZIA** (0 rows)
- [x] Tabelas auxiliares: convenio, material, procedimento

### Definição por Dashboard
- [x] Dashboard Financeiro — glosas por convênio, estabelecimento, setor, tipo, protocolo, mensal
- [x] Dashboard Enfermagem — etapa (cd_convenio_parametro) + glosas_por_item
- [x] Dashboard Médico — procedimento_paciente (todas dimensões)
- [x] Dashboard Farmácia — cpoe_material + material (prescrições)
- [x] Dashboard Centro Cirúrgico — procedimento_paciente filtrado ie_tiss_tipo_guia='7'
- [x] Dashboard Fisioterapia — procedimento_paciente filtrado ds_procedimento ILIKE '%fisio%'

---

## FASE 6 — Frontend: Login + Hub ✅

### Login
- [x] Criar `frontend/login.html` — formulário AngularJS login/senha
- [x] Criar `frontend/js/auth.service.js` — login/logout/getToken
- [x] Criar `frontend/js/autorizacao.service.js` — podeAcessar/getDashboardsDisponiveis
- [x] Conectar POST /api/auth/login
- [x] Armazenar JWT no localStorage
- [x] Tratar erro de credenciais

### Hub
- [x] Criar `frontend/hub.html` — cards de dashboards autorizados
- [x] Botão logout
- [x] Verificar autenticação ao carregar
- [x] Redirecionar para login se não autenticado

### Infraestrutura
- [x] Criar `frontend/css/common.css` — estilos compartilhados
- [x] Criar `frontend/js/api.service.js` — chamadas API com JWT
- [x] Express static file serving (frontend/)
- [x] Catch-all para login.html

---

## FASE 7 — Criar Dashboards do Zero ✅

### Cada dashboard = HTML standalone + CSS + JS próprio

- [x] Dashboard Financeiro
  - [x] Criar `frontend/dashboard-financeiro.html`
  - [x] KPIs: total faturado, recebido, glosado, taxa glosa
  - [x] Gráficos: barras (glosas por convênio)
  - [x] Tabela: dados multivariados (faturado, recebido, glosado, % glosa)
  - [x] Conectar POST /api/glosas com JWT
  - [x] Dimensões: convenio, estabelecimento, setor, tipo_convenio, tipo_protocolo, mes

- [x] Dashboard Enfermagem
  - [x] Criar `frontend/dashboard-enfermagem.html`
  - [x] Módulo duplo: etapa + glosas_por_item com seletor
  - [x] KPIs: atendimentos, pacientes, valor
  - [x] Conectar POST /api/etapa + POST /api/glosas com JWT

- [x] Dashboard Médico
  - [x] Criar `frontend/dashboard-medico.html`
  - [x] KPIs: atendimentos, procedimentos, valor produzido, valor médico
  - [x] Conectar POST /api/pempfrg com JWT

- [x] Dashboard Farmácia
  - [x] Criar `frontend/dashboard-farmacia.html`
  - [x] KPIs: prescrições, pacientes, materiais, prescr/paciente
  - [x] Dimensões: material, setor, antibiotico, mes
  - [x] Conectar POST /api/farmacia com JWT

- [x] Dashboard Centro Cirúrgico
  - [x] Criar `frontend/dashboard-centrocirurgico.html`
  - [x] KPIs: procedimentos, atendimentos, valor produzido, proc/atendimento
  - [x] Dimensões: procedimento, convenio, setor, medico, porte, mes
  - [x] Conectar POST /api/centrocirurgico com JWT

- [x] Dashboard Fisioterapia
  - [x] Criar `frontend/dashboard-fisioterapia.html`
  - [x] KPIs: atendimentos, pacientes, valor produzido, atend/paciente
  - [x] Dimensões: procedimento, convenio, setor, medico, mes
  - [x] Conectar POST /api/fisioterapia com JWT

---

## FASE 8 — Testes e Deploy

### Correções de contrato e escopo — 28/08/2026
- [x] Restringir dimensões e indicadores do dashboard médico ao contrato de `pempfrg`
- [x] Remover opções herdadas de glosas/MatMed da configuração médica
- [x] Alinhar dimensões e indicadores das seis dashboards aos controllers reais
- [x] Aplicar escopo de setor/estabelecimento no backend antes das agregações
- [x] Exigir domínio no endpoint compartilhado `/api/pempfrg`
- [x] Bloquear abertura direta de dashboard sem permissão
- [x] Validar escopo global, restrito e ausente com JWT sintético
- [x] Confirmar colunas de identidade e escopo via metadados read-only do PostgreSQL
- [x] Documentar contratos efetivos e limitações conhecidas

### Testes
- [ ] Login com credenciais válidas → redireciona para hub
- [ ] Hub mostra apenas dashboards do perfil
- [ ] Cada dashboard carrega dados reais
- [ ] Filtros funcionam
- [ ] Formatação pt-BR correta
- [ ] Logout funciona
- [ ] Acesso sem token → redireciona login
- [ ] Perfil 1848 (Admin) → vê todas as dashboards

### Deploy
- [ ] Configurar .env de produção
- [ ] Configurar PM2 ou systemd
- [ ] Configurar nginx reverse proxy
- [ ] Testar em produção

---

## Resumo de Progresso

| Fase | Status | Arquivos |
|------|--------|----------|
| 1 - Backend Base | ✅ CONCLUÍDA | 6 arquivos |
| 2 - Autenticação | ✅ CONCLUÍDA | 6 arquivos |
| 3 - Endpoints Dados | ✅ CONCLUÍDA | 11 arquivos |
| 4 - Testes Backend | ✅ CONCLUÍDA | Todos endpoints OK |
| 5 - Análise Banco | ✅ CONCLUÍDA | Mapeamento completo |
| 6 - Frontend Login+Hub | ✅ CONCLUÍDA | 6 arquivos |
| 7 - Dashboards (6) | ✅ CONCLUÍDA | 6 dashboards |
| 8 - Testes e Deploy | ⏳ PENDENTE | Configurações |

**Total de arquivos criados (backend):** 24
**Total de arquivos criados (frontend):** 9
**Progresso geral:** 90%

---

*Última atualização: 28/08/2026*
