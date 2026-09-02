# Setup e Operação

## Pré-requisitos

- Node.js v18+
- Acesso à rede interna do PostgreSQL (réplica ODS do TASY)

## Variáveis de ambiente

Criar `tasy-analytics-backend/.env` (não versionado):

| Variável | Descrição |
|---|---|
| `PORT` | porta do servidor Express (default 3000) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | conexão PostgreSQL (schema `ods.*`, somente leitura) |
| `JWT_SECRET` | segredo de assinatura do token |
| `JWT_EXPIRATION` | validade do token (ex. `8h`) |
| `DEV_MODE` | `true`/`false` — ver aviso abaixo |
| `NODE_ENV` | `production` bloqueia o boot se `DEV_MODE=true` |
| `ALLOWED_ORIGIN` | (opcional) lista de origens permitidas por CORS, separadas por vírgula |

⚠️ `DEV_MODE=true` nunca pode subir com `NODE_ENV=production` — o servidor recusa iniciar (guard em `app.js`), pois isso bypassa toda a autenticação. Ver [SEGURANCA.md](SEGURANCA.md).

## Rodando localmente

```bash
cd tasy-analytics-backend
npm install
npm run dev      # nodemon, recarrega ao salvar
# ou
npm start        # node src/app.js, produção
```

Acesse `http://localhost:3000/login.html`. O Express serve `frontend/` como estático e cai em `login.html` para qualquer rota não-API (`app.get('*', ...)` em `app.js`).

Não há build step, bundler, suíte de testes nem linter configurados no repo — frontend é HTML/CSS/JS puro.

## Login de teste

Em `DEV_MODE=true`, o login aceita **qualquer senha** para um `nm_usuario` válido e existente em `ods.usuario`. Se esse usuário não tiver perfil, recebe automaticamente o perfil Admin (acesso total). Use qualquer login de usuário ativo do TASY — não há credencial fixa documentada aqui de propósito, para não versionar login/senha reais.

## `GET /api/health`

Sem autenticação, roda `SELECT NOW()` no banco — útil para checar se a conexão com o PostgreSQL está de pé.

## Restrições conhecidas

- Usuário DB (`ANALITICS`) é read-only — não é possível alterar senhas nem escrever no banco.
- Tabela `fat_rec_item` está vazia — dados de faturamento vêm de `procedimento_paciente`.
- `glosas_por_item` não tem dados de agosto/2026 (só até julho).
- Autenticação fora de `DEV_MODE` ainda não é confiável — ver [SEGURANCA.md](SEGURANCA.md#pendência-conhecida-hash-de-senha-do-tasy).
