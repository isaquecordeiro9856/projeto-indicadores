# Documentação Arquitetural — TASY Analytics
## Controle de Acesso por Perfis + Dashboards por Setor

> **Documentação de arquitetura para o sistema TASY Analytics** — RBAC, autenticação, e dashboards criadas do zero para cada perfil/setor do hospital, com dados reais do banco PostgreSQL.

---

## Sumário
1. [Visão Geral](#1-visão-geral)
2. [Objetivos](#2-objetivos)
3. [Restrições](#3-restrições)
4. [Análise do Banco de Dados](#4-análise-do-banco-de-dados)
5. [Arquitetura Geral](#5-arquitetura-geral)
6. [Autenticação (Login)](#6-autenticação-login)
7. [Autorização (Controle de Acesso)](#7-autorização-controle-de-acesso)
8. [Mapeamento de Perfis e Dashboards](#8-mapeamento-de-perfis-e-dashboards)
9. [Estrutura do Backend](#9-estrutura-do-backend)
10. [Dashboards por Perfil](#10-dashboards-por-perfil)
11. [Serviços Frontend](#11-serviços-frontend)
12. [Segurança](#12-segurança)
13. [Plano de Implementação](#13-plano-de-implementação)

---

## 1. Visão Geral

A suíte TASY Analytics é um sistema de indicadores hospitalares que será construído **do zero**, com:

- **Login** contra a tabela `ods.usuario` existente (sem criar/alterar tabelas)
- **Controle de acesso** por perfil (`cd_perfil_inicial`) — cada perfil vê apenas as dashboards relevantes ao seu setor
- **Dashboards novas** — criadas para cada perfil/setor, com dados reais do PostgreSQL
- **Referência de design** — a pasta `ideiainterfaces` contém protótipos anteriores usados apenas como inspiração visual; os dashboards reais serão criados como arquivos novos

### 1.1 Sobre a pasta `ideiainterfaces`

A pasta `ideiainterfaces` contém 3 dashboards原型 (glosas-por-convenio, etapa, pempfrg) que servem **apenas como referência de design e UX**. Elas:
- Foram criadas como protótipos com dados mock
- **NÃO** serão modificadas ou integradas diretamente
- Servem como inspiração para layout, cores,-componentes, e padrões de interação
- Os dashboards finais serão criados como arquivos novos no frontend

---

## 2. Objetivos

| Objetivo | Prioridade | Descrição |
|----------|-----------|-----------|
| Login via tabela `usuario` | **Alta** | Validar credenciais contra `ods.usuario` |
| Controle de acesso por perfil | **Alta** | `cd_perfil_inicial` define quais dashboards o usuário acessa |
| Hub/Menu principal | **Alta** | Listar apenas dashboards autorizados para o perfil |
| Dashboards por perfil | **Alta** | Cada setor vê apenas as métricas relevantes ao seu trabalho |
| Dados reais do PostgreSQL | **Alta** | Queries diretas no banco, sem mock |
| Perfil Admin acesso total | **Alta** | Perfil 1848 (Auditoria) acessa TODAS as dashboards |
| Dashboard auto-contidas | **Alta** | Cada dashboard é um HTML standalone com CSS/JS próprios |

---

## 3. Restrições

| Restrição | Motivo |
|-----------|--------|
| Não criar tabelas no banco | O banco é gerenciado pela equipe do Tasy |
| Não alterar tabelas existentes | Integridade do sistema legado |
| Usar tabela `usuario` existente | Única tabela de usuários disponível |
| Backend Node.js + Express | Ecossistema same do frontend AngularJS |
| Frontend puro: HTML + CSS + JS | Sem build, arquivos estáticos |
| AngularJS 1.8.2 + Chart.js 4.4.9 | Bibliotecas já no projeto |

---

## 4. Análise do Banco de Dados

### 4.1 Tabelas Principais do Schema `ods`

| Tabela | Registros | Descrição |
|--------|-----------|-----------|
| `usuario` | 3.023 | Usuários (login, perfil, setor) — 128 colunas |
| `glosas_protocolos` | 10.385 | Glosas por protocolo (vl_protocolo, vl_glosado, vl_pago, etc.) |
| `glosas_por_item` | 132.120 | Glosas detalhadas por item |
| `conta_paciente` | 947.142 | Contas de pacientes (qt_dias_conta, convenio, etapa) |
| `convenio` | 67 | Convênios/operadoras |
| `fat_rec_item` | Grande | Tabela denormalizada ideal para produtividade/faturamento |
| `procedimento_paciente` | 3.619.866 | Procedimentos realizados |
| `procedimento` | 26.464 | Catálogo de procedimentos |
| `medico` | - | Cadastro de médicos |
| `pessoa_fisica` | - | Pessoas (pacientes, funcionários) |
| `nota_fiscal` | - | Notas fiscais |
| `material` | - | Materiais e medicamentos |

### 4.2 Tabela `usuario` — Campos Relevantes

```sql
nm_usuario            TEXT PRIMARY KEY    -- Login do usuário
ds_usuario            TEXT                -- Nome completo
ie_situacao           TEXT                -- A=Ativo, I=Inativo
cd_setor_atendimento  NUMERIC            -- Código do setor
cd_estabelecimento    NUMERIC            -- Código do estabelecimento
cd_perfil_inicial     NUMERIC            -- Código do perfil Tasy
ie_profissional       TEXT                -- M=Médico, E=Enfermeiro, FI=Fisioterapeuta
ds_senha              TEXT                -- Hash da senha (64 chars)
```

### 4.3 Dados Reais Disponíveis por Area

| Area do Hospital | Tabelas Principais | Métricas Possíveis |
|-----------------|-------------------|-------------------|
| **Financeiro/Glosas** | `glosas_protocolos`, `glosas_por_item`, `convenio` | Valor glosado, recebido, faturado, % glosa, por convênio/setor/tipo |
| **Permanência/Etapa** | `conta_paciente`, `glosas_por_item` | Dias permanência, média etapa, contas por etapa/convenio/motivo |
| **Produção/Faturamento** | `fat_rec_item` (denormalizada) | Produção, faturamento, recebimento, glosa, repasse médico, por setor/médico/procedimento |
| **Procedimentos** | `procedimento_paciente`, `procedimento` | Qtd procedimentos, valores, por médico/setor/grupo |

> **Nota sobre tabelas de dimensão**: As tabelas `setor`, `tipo_convenio`, `tipo_atendimento`, `etapa`, `motivo_devolucao` **NÃO existem como tabelas standalone** no banco. Os dados de dimensão estão armazenados como colunas de texto nas tabelas principais (ex: `ds_setor_atendimento` em `fat_rec_item`, `ds_tipo_protocolo` em `glosas_protocolos`). As queries usam essas colunas diretamente ou fazem JOIN com tabelas de catálogo quando disponíveis.

---

## 5. Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│  HTML standalone + CSS + AngularJS 1.8.2 + Chart.js 4.4.9       │
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────────────────┐│
│  │  Login   │──▶│   Hub    │──▶│  Dashboards por Perfil       ││
│  │  .html   │   │  .html   │   │  (criadas do zero)           ││
│  └──────────┘   └──────────┘   └──────────────────────────────┘│
│       │              │                      │                    │
│  POST /api/auth   GET /api/auth/me     POST /api/dados/:module  │
│       │              │                      │                    │
│       └──────────────┼──────────────────────┘                    │
│                      │ JWT Token                                 │
└──────────────────────┼──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                BACKEND (Node.js + Express)                        │
│                                                                  │
│  POST /api/auth/login    → Valida credenciais, retorna JWT      │
│  GET  /api/auth/me       → Retorna dados + permissões           │
│  POST /api/glosas        → Queries glosas (auth + autorização)  │
│  POST /api/etapa         → Queries etapa (auth + autorização)   │
│  POST /api/pempfrg       → Queries pempfrg (auth + autorização) │
│  POST /api/dados/:module → Endpoint genérico futuro             │
│                                                                  │
│  permissoes.js → Mapeamento cd_perfil_inicial → dashboards      │
└──────────────────────┬──────────────────────────────────────────┘
                       │ SQL Queries
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              PostgreSQL (10.77.1.203:5432/ods)                    │
│  Tabelas: usuario, glosas_protocolos, glosas_por_item,          │
│           conta_paciente, fat_rec_item, convenio, etc.           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Autenticação (Login)

### 6.1 Fluxo

```
1. Usuário preenche login + senha → POST /api/auth/login
2. Backend: SELECT * FROM ods.usuario WHERE nm_usuario = $1
3. Valida ie_situacao = 'A' (ativo)
4. Valida senha (hash vs banco)
5. Gera JWT: { nm_usuario, cd_perfil_inicial, ds_usuario, exp: 8h }
6. Retorna token + dados do usuário + permissões
7. Frontend armazena JWT no localStorage → redireciona para hub.html
```

### 6.2 Estrutura do JWT

```json
{
  "nm_usuario": "adcordeiro",
  "cd_perfil_inicial": 2286,
  "ds_usuario": "Adriana Cordeiro",
  "exp": 1756483200
}
```

---

## 7. Autorização (Controle de Acesso)

### 7.1 Camadas de Segurança

```
Camada 1: Frontend — UI oculta dashboards não autorizadas
Camada 2: Frontend — $routeChangeStart verifica JWT
Camada 3: Backend — Middleware auth.js valida JWT em CADA requisição
Camada 4: Backend — Middleware autorizacao.js verifica permissão no módulo
Camada 5: Backend — Controller filtra dados por escopo do usuário
```

### 7.2 Fluxo de Acesso

```
1. Usuário clica no dashboard no hub
2. Frontend redireciona para dashboard.html
3. Dashboard carrega → verifica JWT no localStorage
4. Se não autenticado → redireciona para login.html
5. POST /api/<modulo> com JWT no header Authorization
6. Backend: valida JWT → valida permissão no dashboard → executa query → retorna dados
```

---

## 8. Mapeamento de Perfis e Dashboards

### 8.1 Perfis Cadastrados no Tasy

| cd_perfil_inicial | Descrição | Dashboards |
|-------------------|-----------|------------|
| **1848** | **Admin (Auditoria)** | **TODAS** (acesso total) |
| 2286 | Enfermagem Técnico CPOE | Enfermagem, Financeiro |
| 2279 | Médico Internação CPOE | Médico, Financeiro |
| 2283 | Enfermeiro Internação CPOE | Enfermagem |
| 2169 | Farmácia Operacional | Farmácia |
| 2281 | Médico Ambulatório | Médico |
| 2149 | Administrativo/Financeiro | Financeiro |
| 2181 | Centro Cirúrgico | Centro Cirúrgico |
| 2170 | Farmacêutico | Farmácia |
| 2353 | Fisioterapeuta | Fisioterapia |
| 2143 | Administrativo | Financeiro |
| 2158 | Enfermagem Setor 34 | Enfermagem |
| 2028 | Gestão Setor 30 | Enfermagem, Financeiro |
| 2356 | Setor 9 | Farmácia |
| 2251 | Setor 37 | Farmácia |
| 2173 | Setor 41 | Nenhuma |
| NULL | Sem perfil | Nenhuma |

### 8.2 Dashboards Disponíveis

| ID Dashboard | Nome | Descrição | Perfis com Acesso |
|-------------|------|-----------|-------------------|
| `enfermagem` | Painel de Enfermagem | Pacientes, permanência, leitos, auxílio de custo | 1848, 2286, 2283, 2158, 2028 |
| `medico` | Painel Médico | Procedimentos, produtividade, repasse médico | 1848, 2279, 2281 |
| `farmacia` | Painel Farmácia | Materiais, medicamentos, matmed | 1848, 2169, 2170, 2356, 2251 |
| `financeiro` | Painel Financeiro | Faturamento, recebimento, glosas | 1848, 2286, 2279, 2149, 2028, 2143 |
| `centrocirurgico` | Centro Cirúrgico | Cirurgias, salas, equipamentos | 1848, 2181 |
| `fisioterapia` | Fisioterapia | Atendimentos, internações, internações | 1848, 2353 |

### 8.3 Configuração de Permissões (permissoes.js)

```javascript
const MAPA_PERFIS = {
  1848: { descricao: 'Admin - Auditoria', dashboards: ['enfermagem','medico','farmacia','financeiro','centrocirurgico','fisioterapia'], exportar: true, configurar: true },
  2286: { descricao: 'Enfermagem Técnico CPOE', dashboards: ['enfermagem','financeiro'], exportar: true, configurar: false },
  2279: { descricao: 'Médico Internação CPOE', dashboards: ['medico','financeiro'], exportar: true, configurar: false },
  2283: { descricao: 'Enfermeiro Internação CPOE', dashboards: ['enfermagem'], exportar: true, configurar: false },
  2169: { descricao: 'Farmácia Operacional', dashboards: ['farmacia'], exportar: true, configurar: false },
  2281: { descricao: 'Médico Ambulatório', dashboards: ['medico'], exportar: true, configurar: false },
  2149: { descricao: 'Administrativo/Financeiro', dashboards: ['financeiro'], exportar: true, configurar: false },
  2181: { descricao: 'Centro Cirúrgico', dashboards: ['centrocirurgico'], exportar: true, configurar: false },
  2170: { descricao: 'Farmacêutico', dashboards: ['farmacia'], exportar: true, configurar: false },
  2353: { descricao: 'Fisioterapeuta', dashboards: ['fisioterapia'], exportar: true, configurar: false },
  2143: { descricao: 'Administrativo', dashboards: ['financeiro'], exportar: true, configurar: false },
  2158: { descricao: 'Enfermagem Setor 34', dashboards: ['enfermagem'], exportar: true, configurar: false },
  2028: { descricao: 'Gestão Setor 30', dashboards: ['enfermagem','financeiro'], exportar: true, configurar: false },
  2356: { descricao: 'Setor 9', dashboards: ['farmacia'], exportar: false, configurar: false },
  2251: { descricao: 'Setor 37', dashboards: ['farmacia'], exportar: false, configurar: false },
  2173: { descricao: 'Setor 41', dashboards: [], exportar: false, configurar: false }
};
```

---

## 9. Estrutura do Backend

### 9.1 Diretórios

```
tasy-analytics-backend/
├── package.json
├── .env
├── .gitignore
├── src/
│   ├── app.js                          # Express server
│   ├── config/
│   │   ├── database.js                 # Pool PostgreSQL
│   │   └── permissoes.js               # Mapeamento de perfis
│   ├── middleware/
│   │   ├── auth.js                     # Validação JWT
│   │   └── autorizacao.js              # Verificação de permissões
│   ├── routes/
│   │   ├── auth.js                     # POST /login, GET /me
│   │   ├── glosas.js                   # POST /api/glosas
│   │   ├── etapa.js                    # POST /api/etapa
│   │   └── pempfrg.js                  # POST /api/pempfrg
│   ├── controllers/
│   │   ├── authController.js           # Login + /me + resetSenhaTemp
│   │   ├── glosasController.js         # Queries financeiro/glosas
│   │   ├── etapaController.js          # Queries etapa/permanência
│   │   └── pempfrgController.js        # Queries produção/faturamento
│   ├── services/
│   │   ├── usuarioService.js           # Consultas à tabela usuario
│   │   └── resetSenha.js               # Reset temporário de senha
│   └── utils/
│       ├── formatar.js                 # Formatação pt-BR
│       └── periodo.js                  # Extração de período
```

---

## 10. Dashboards por Perfil

### 10.1 Dashboard: Enfermagem

**Destinatários**: Enfermeiros, técnicos de enfermagem
**Dados fonte**: `conta_paciente`, `glosas_por_item`

**Métricas/KPIs**:
- Pacientes internados (total)
- Dias de permanência total / média
- Contas por etapa (alta, transferência, óbito)
- Glosas por motivo de devolução

**Dimensões**: convenio, estabelecimento, motivo_devolucao, mes

**Gráficos**:
- Barras: contas por etapa
- Rosca: distribuição por tipo de atendimento
- Linha: evolução mensal de permanência

---

### 10.2 Dashboard: Médico

**Destinatários**: Médicos
**Dados fonte**: `procedimento_paciente`

**Métricas/KPIs**:
- Procedimentos realizados (total)
- Valor produzido
- Repasse médico (valor do médico)

**Dimensões**: convenio, setor, medico_executor, procedimento, mes

**Gráficos**:
- Barras: top procedimentos por valor
- Rosca: distribuição por tipo de atendimento
- Linha: evolução mensal de produção

---

### 10.3 Dashboard: Farmácia

**Destinatários**: Farmacêuticos, técnicos de farmácia
**Dados fonte**: `cpoe_material`, `material`

**Métricas/KPIs**:
- Consumo de materiais/medicamentos (valor total)
- Top materiais por consumo
- Consumo por setor
- Consumo por tipo de material

**Dimensões**: material, setor, mes, antibiotico

**Gráficos**:
- Barras: top materiais por valor
- Rosca: distribuição por tipo
- Linha: evolução mensal de consumo

---

### 10.4 Dashboard: Financeiro

**Destinatários**: Gestores financeiros, administrativo
**Dados fonte**: `glosas_protocolos`, `glosas_por_item`

**Métricas/KPIs**:
- Total faturado / recebido / glosado
- Taxa de glosa (%)
- Glosas por convênio
- Glosas por tipo de protocolo
- Evolução mensal

**Dimensões**: convenio, setor, tipo_convenio, tipo_protocolo, mes

**Gráficos**:
- Barras: glosas por convênio
- Linha: evolução mensal
- Rosca: distribuição por tipo de protocolo

---

### 10.5 Dashboard: Centro Cirúrgico

**Destinatários**: Equipe do centro cirúrgico
**Dados fonte**: `procedimento_paciente` (filtrado por `ie_tiss_tipo_guia = '7'`)

**Métricas/KPIs**:
- Cirurgias realizadas
- Valor produzido em cirurgias
- Salas utilization (por tipo)
- Glosas em procedimentos cirúrgicos

**Dimensões**: procedimento, convenio, setor, medico, porte, mes

---

### 10.6 Dashboard: Fisioterapia

**Destinatários**: Fisioterapeutas
**Dados fonte**: `procedimento_paciente` (filtrado por descrição contendo `fisio`)

**Métricas/KPIs**:
- Atendimentos realizados
- Internações com fisioterapia
- Valor produzido
- Evolução mensal

**Dimensões**: procedimento, convenio, setor, medico, mes

---

### 10.7 Dashboard: Admin (1848)

**Destinatários**: Admin/Auditoria — acesso TOTAL
**Dados fonte**: TODAS as tabelas

**Métricas/KPIs**: TODAS as métricas de todas as dashboards anteriores, consolidadas

**Visão consolidada**:
- KPIs gerais do hospital (total pacientes, total faturado, total glosado, taxa glosa geral)
- Acesso rápido a qualquer dashboard
- Visão por setor com drill-down

---

## 11. Serviços Frontend

### 11.1 AuthService

```javascript
// js/auth.service.js
angular.module('DashboardApp').factory('AuthService', function($http) {
  var API_URL = '/api/auth';
  
  return {
    login: function(nm_usuario, ds_senha) {
      return $http.post(API_URL + '/login', { nm_usuario: nm_usuario, ds_senha: ds_senha })
        .then(function(response) {
          localStorage.setItem('tasy_token', response.data.token);
          localStorage.setItem('tasy_usuario', JSON.stringify(response.data.usuario));
          localStorage.setItem('tasy_perfil', JSON.stringify(response.data.perfil));
          return response.data;
        });
    },
    logout: function() {
      localStorage.removeItem('tasy_token');
      localStorage.removeItem('tasy_usuario');
      localStorage.removeItem('tasy_perfil');
    },
    getToken: function() { return localStorage.getItem('tasy_token'); },
    getUsuario: function() { var u = localStorage.getItem('tasy_usuario'); return u ? JSON.parse(u) : null; },
    getPerfil: function() { var p = localStorage.getItem('tasy_perfil'); return p ? JSON.parse(p) : null; },
    isLoggedIn: function() { return !!this.getToken(); }
  };
});
```

### 11.2 AutorizacaoService

```javascript
// js/autorizacao.service.js
angular.module('DashboardApp').factory('AutorizacaoService', function(AuthService) {
  return {
    podeAcessar: function(dashboard) {
      var perfil = AuthService.getPerfil();
      if (!perfil) return false;
      return perfil.dashboards.indexOf(dashboard) !== -1;
    },
    podeExportar: function() {
      var perfil = AuthService.getPerfil();
      return perfil ? perfil.exportar : false;
    },
    podeConfigurar: function() {
      var perfil = AuthService.getPerfil();
      return perfil ? perfil.configurar : false;
    },
    getDashboardsDisponiveis: function() {
      var perfil = AuthService.getPerfil();
      if (!perfil) return [];
      var todos = [
        { id: 'enfermagem', nome: 'Painel Enfermagem', descricao: 'Pacientes, permanência, leitos', icon: 'E' },
        { id: 'medico', nome: 'Painel Médico', descricao: 'Procedimentos, produtividade', icon: 'M' },
        { id: 'farmacia', nome: 'Painel Farmácia', descricao: 'Materiais, medicamentos', icon: 'F' },
        { id: 'financeiro', nome: 'Painel Financeiro', descricao: 'Faturamento, glosas', icon: '$' },
        { id: 'centrocirurgico', nome: 'Centro Cirúrgico', descricao: 'Cirurgias, salas', icon: 'C' },
        { id: 'fisioterapia', nome: 'Fisioterapia', descricao: 'Atendimentos, internações', icon: 'P' }
      ];
      return todos.filter(function(d) { return perfil.dashboards.indexOf(d.id) !== -1; });
    }
  };
});
```

---

## 12. Segurança

| Aspecto | Implementação |
|---------|---------------|
| **Senhas** | Valida contra hash existente na tabela `usuario` |
| **JWT** | Assinatura HMAC-SHA256, expiração de 8 horas |
| **Backend** | Valida JWT + permissão em CADA requisição |
| **Frontend** | Oculta UI (não é autoridade de segurança) |
| **CORS** | Configurado para aceitar apenas o domínio do frontend |
| **Rate Limit** | Limita 5 tentativas de login por minuto |
| **Logs** | Registra tentativas de acesso para auditoria |

---

## 12.1 Contratos vigentes e escopo implementado (28/08/2026)

`ideiainterfaces` permanece somente como referência visual. A interface integrada usa os contratos dos controllers atuais e não deve exibir uma opção apenas porque ela existe no protótipo.

| Dashboard | Endpoint | Dimensões válidas | Indicadores válidos | Fonte principal |
|---|---|---|---|---|
| Médico | `/api/pempfrg` | `convenio`, `setor`, `medico_executor`, `procedimento`, `mes` | `qtd_contas`, `qtd_procedimentos`, `valor_produzido`, `valor_medico` | `ods.procedimento_paciente` |
| Farmácia | `/api/farmacia` | `material`, `setor`, `mes`, `antibiotico` | `qtd_prescricoes`, `qtd_pacientes`, `qtd_materiais` | `ods.cpoe_material` + `ods.material` |
| Centro Cirúrgico | `/api/centrocirurgico` | `procedimento`, `convenio`, `setor`, `medico`, `porte`, `mes` | `qtd_contas`, `qtd_procedimentos`, `valor_produzido` | `ods.procedimento_paciente`, guia `7` |
| Fisioterapia | `/api/fisioterapia` | `procedimento`, `convenio`, `setor`, `medico`, `mes` | `qtd_contas`, `qtd_atendimentos`, `valor_produzido`, `valor_medico` | `ods.procedimento_paciente`, descrição `fisio` |
| Financeiro | `/api/glosas` | `convenio`, `estabelecimento`, `setor`, `tipo_convenio`, `tipo_protocolo`, `mes` | valores financeiros e percentuais definidos em `glosasController.js` | `ods.glosas_protocolos` + `ods.glosas_por_item` |
| Enfermagem | `/api/etapa` | `convenio`, `estabelecimento`, `motivo_devolucao`, `mes` | `qtd_contas`, `dias_etapa`, `media_etapa`, `vl_conta` | `ods.conta_paciente` + `ods.glosas_por_item` |

### Regras

- As listas de dimensões e indicadores são específicas por domínio no frontend.
- O backend valida dimensão e indicador antes de consultar e continua sendo a autoridade.
- `/api/pempfrg` exige `dashboard` e rejeita domínio ausente ou não autorizado.
- O perfil `1848` é global; os demais usam estabelecimento e/ou setor cadastrados em `ods.usuario`.
- Escopo ausente para perfil não global resulta em consulta vazia (`AND 1 = 0`), nunca em consulta ampla.
- `buscarPorLogin` carrega somente os campos de identidade necessários ao escopo.

### Limitações conhecidas

- Procedimentos e CPOE têm setor, mas não apresentam `cd_estabelecimento` no schema validado; nesses domínios o filtro é por setor.
- O vínculo entre `cd_pessoa_fisica` e código de médico executor não foi comprovado; o filtro individual por médico não foi ativado.
- Contratos em `ideiainterfaces` são legados e podem mencionar dimensões inexistentes nos controllers atuais.

## 13. Plano de Implementação

### Fase 1 ✅ Backend Base
- Estrutura Express, package.json, .env, database.js, permissoes.js, app.js

### Fase 2 ✅ Autenticação
- usuarioService.js, authController.js, auth.js, autorizacao.js, rotas auth

### Fase 3 ✅ Endpoints de Dados
- Controllers glosas, etapa, pempfrg + rotas + utils

### Fase 4 ⏳ Testes Backend
- Resetar senha de teste, validar login + endpoints com dados reais

### Fase 5 ⏳ Análise do Banco + Definição de Dashboards
- Mapear exatamente quais colunas/tabelas existem para cada métrica
- Validar queries com dados reais
- Definir layout de cada dashboard

### Fase 6 ⏳ Frontend: Login + Hub
- login.html, hub.html, auth.service.js, autorizacao.service.js

### Fase 7 ⏳ Criar Dashboards do Zero
- Enfermagem: dashboard-enfermagem.html + js
- Médico: dashboard-medico.html + js
- Farmácia: dashboard-farmacia.html + js
- Financeiro: dashboard-financeiro.html + js
- Centro Cirúrgico: dashboard-centrocirurgico.html + js
- Fisioterapia: dashboard-fisioterapia.html + js

### Fase 8 ⏳ Testes e Deploy

---

*Documentação v4.0 — 28/08/2026 — Dashboards novas por perfil, dados reais, login + RBAC*
