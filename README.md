# TASY Analytics

Painéis de indicadores hospitalares com dados reais do TASY (PostgreSQL), controlados por RBAC por perfil de usuário.

## Como Rodar

### Pré-requisitos
- Node.js v18+
- Acesso à rede interna (banco PostgreSQL em `10.77.1.203:5432`)

### Iniciar

```bash
cd tasy-analytics-backend
npm install
node src/app.js
```

Acesse: **http://localhost:3000/login.html**

### Credenciais de Teste

| Usuário  | Senha     | Perfil             |
|----------|-----------|--------------------|
| isaque   | dhfxop90  | Admin (DEV_MODE)   |

> Em DEV_MODE, qualquer usuário sem perfil recebe automaticamente o perfil Admin (acesso total).

## Arquitetura

```
projetoindicadores/
├── tasy-analytics-backend/     # Node.js + Express
│   ├── src/
│   │   ├── app.js              # Servidor Express (porta 3000)
│   │   ├── config/
│   │   │   ├── database.js     # Pool PostgreSQL
│   │   │   └── permissoes.js   # RBAC: 16 perfis → dashboards
│   │   ├── controllers/        # 7 controllers (glosas, etapa, pempfrg, farmacia, cc, fisio)
│   │   ├── middleware/         # auth.js (JWT), autorizacao.js (RBAC)
│   │   ├── routes/            # 7 rotas REST
│   │   ├── services/          # usuarioService.js, resetSenha.js
│   │   └── utils/             # periodo.js, formatar.js
│   └── .env                   # DEV_MODE=true, credenciais DB
├── frontend/                  # AngularJS 1.8.2 + Chart.js 4.4.9
│   ├── login.html
│   ├── hub.html
│   ├── dashboard-financeiro.html
│   ├── dashboard-enfermagem.html
│   ├── dashboard-medico.html
│   ├── dashboard-farmacia.html
│   ├── dashboard-centrocirurgico.html
│   ├── dashboard-fisioterapia.html
│   ├── css/common.css
│   └── js/
│       ├── auth.service.js
│       ├── autorizacao.service.js
│       └── api.service.js
└── ideiainterfaces/           # Referência de design (não integrado)
```

## Dashboards

| Dashboard        | Dados                        | Dimensões                                         |
|------------------|------------------------------|----------------------------------------------------|
| Financeiro       | glosas_protocolos            | Convênio, Estabelecimento, Setor, Tipo, Protocolo, Mês |
| Enfermagem       | etapa + glosas_por_item      | Convênio, Estabelecimento, Motivo, Mês              |
| Médico           | procedimento_paciente        | Convênio, Setor, Médico, Procedimento, Mês          |
| Farmácia         | cpoe_material + material     | Material, Setor, Antibiótico, Mês                   |
| Centro Cirúrgico | procedimento_paciente (guia 7) | Procedimento, Convênio, Setor, Médico, Porte, Mês  |
| Fisioterapia     | procedimento_paciente (fisio) | Procedimento, Convênio, Setor, Profissional, Mês    |

## Controle de Acesso (RBAC)

Cada perfil de usuário (cd_perfil_inicial) tem acesso a dashboards específicos. O mapa está em `src/config/permissoes.js`.

Exemplo:
- **1848 (Admin)**: todos os 6 dashboards
- **2286 (Enfermagem)**: enfermagem, financeiro, médico
- **2353 (Fisioterapia)**: fisioterapia + dados gerais
- **2181 (Centro Cirúrgico)**: centro cirúrgico + dados gerais

## Stack

- **Backend**: Node.js + Express + pg (PostgreSQL)
- **Frontend**: AngularJS 1.8.2 + Chart.js 4.4.9
- **Banco**: PostgreSQL 10.77.1.203:5432 (somente leitura)
- **Auth**: JWT com DEV_MODE bypass

## Restrições

- Usuário DB (`ANALITICS`) é read-only — não é possível alterar senhas
- Tabela `fat_rec_item` está vazia — dados de faturamento vêm de `procedimento_paciente`
- `glosas_por_item` não tem dados de agosto/2026 (só até julho)
- Algoritmo de hash de senha do TASY é desconhecido — DEV_MODE contorna isso
