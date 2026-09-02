# Segurança: Autenticação, RBAC e Escopo de Dados

Três camadas independentes, aplicadas nessa ordem em cada request de dados:

1. **Autenticação** (`middleware/auth.js`) — JWT válido?
2. **Autorização por dashboard** (`middleware/autorizacao.js` + `config/permissoes.js`) — o perfil do usuário tem acesso a este dashboard?
3. **Escopo de linhas** (`services/escopoAcesso.js` + `config/supervisao.js`) — dentro do dashboard liberado, quais linhas ele pode ver? (hoje: supervisão vê tudo; não supervisor nem chega aqui)

## 1. Autenticação

JWT assinado com `JWT_SECRET`, expiração `JWT_EXPIRATION` (default 8h). Payload inclui `nm_usuario`, `cd_perfil_inicial`, `cd_setor_atendimento`, `cd_estabelecimento`, `cd_pessoa_fisica`, `ie_medico` — usados depois pelas camadas 2 e 3 sem nova consulta ao banco.

`DEV_MODE=true` faz o login aceitar qualquer senha para um `nm_usuario` existente. **Nunca pode subir com `NODE_ENV=production`** — `app.js` recusa iniciar (`process.exit(1)`) se as duas flags estiverem ativas simultaneamente.

### Pendência conhecida: hash de senha do TASY

O algoritmo de hash usado em `ods.usuario.ds_senha` é desconhecido. Fora de `DEV_MODE`, `usuarioService.js` compara a senha recebida em texto puro contra `ds_senha` — **isso não autentica corretamente contra o TASY real**. Como o usuário de banco (`ANALITICS`) é read-only, não há como implementar reset de senha por este app; qualquer reset tem que ser feito pelo próprio TASY. Antes de usar fora de `DEV_MODE`: (1) identificar o algoritmo de hash do TASY, (2) implementar a comparação correta, (3) validar contra usuários reais.

## 2. RBAC (autorização por dashboard)

**O sistema é restrito a supervisão e direção.** Usuário comum (assistencial, operacional, administrativo sem cargo de supervisão) não tem acesso a nada: o login é recusado com **403** antes mesmo de emitir token (`authController.login`), e `GET /api/auth/me` também recusa se o token perdeu o acesso depois de emitido.

`config/permissoes.js` → `resolverPermissao(usuario)` tem só três saídas:

| Nível | Quem é | Dashboards |
|---|---|---|
| `direcao` | `ehDirecao()` — perfil em `PERFIS_DIRECAO` ou login em `USUARIOS_DIRECAO` | os 6 painéis de área **+ `geral`** |
| `supervisor` | `ehSupervisor()` — ver seção 3 | os 6 painéis de área |
| `sem_acesso` | qualquer outro | nenhum (login bloqueado) |

Não há mais mapa perfil→dashboards nem fallback por setor: como supervisão já enxerga **todas** as linhas dos dados (seção 3), restringir a área que ela pode abrir não protegeria nada. `DESCRICOES_PERFIL` sobrou só para exibir o nome do perfil no cabeçalho.

`middleware/autorizacao.js` cruza o resultado com `MODULO_PARA_DASHBOARD` (módulo da API → dashboards que ele atende) para decidir se o request passa. Um módulo multi-dashboard (`pempfrg`) exige que o front informe qual `dashboard` está pedindo; se o valor não pertence à lista do módulo, retorna 400.

O Painel Geral tem middleware próprio, `exigirDirecao`: supervisor que não é direção recebe **403** em qualquer rota `/api/geral/*`.

## 3. Escopo de dados (linha a linha)

O ODS replicado do TASY **não tem campo confiável de chefia** (`ie_coordenador`, `cd_cargo`, `ds_profissao` majoritariamente nulos ou inúteis em levantamento de produção — ver comentário em `config/supervisao.js`). Por isso o acesso é declarado explicitamente em listas:

- `PERFIS_SUPERVISORES` — códigos de perfil do TASY cujo nome de cadastro já é "\<área\> - Supervisão" (ex. 2234 Financeiro, 2118 Higienização).
- `USUARIOS_SUPERVISORES` — logins individuais, para quando a pessoa acumula mais de um perfil no TASY e o perfil de supervisão **não é** o `cd_perfil_inicial` dela (o ODS só replica o perfil inicial, sem tabela de vínculo usuário-perfil).
- `SETORES_SUPERVISORES` — setores cujos ocupantes são supervisores por natureza da área (hoje vazia).
- `PERFIS_DIRECAO` / `USUARIOS_DIRECAO` — direção/presidência. Direção é sempre supervisor também (`ehSupervisor` chama `ehDirecao` primeiro). Não existe perfil "Diretoria" no cadastro do TASY, então na prática a direção é declarada por login.

Como só supervisão e direção entram, **todo usuário autenticado enxerga todas as linhas**. Não existe mais recorte por autoria (`nm_usuario`/`cd_pessoa_fisica`) nem por setor: `COLUNAS_AUTORIA`, `filtroDadosProprios` e `aplicarEscopoSomenteAutoria` foram removidos junto com o acesso de usuário comum.

### Marcador `/* ESCOPO */`

Toda query SQL nos controllers mantém o comentário `/* ESCOPO */` no ponto exato do `WHERE` onde a cláusula de escopo seria injetada em runtime. Hoje `aplicarEscopo` só faz duas coisas:

- supervisor/direção → substitui o marcador por string vazia (sem filtro de linha);
- qualquer outro → substitui por ` AND 1 = 0` (nega tudo).

Esse segundo caso é **defesa em profundidade**, não caminho normal: quem não é supervisor já foi barrado no login e no middleware. O marcador continua obrigatório em toda query nova — é o ponto único onde um filtro de linha voltaria a ser injetado se o acesso for reaberto para outros perfis, e sem ele a query perde o `AND 1 = 0` de falha fechada.

## Headers e outras proteções

- `helmet` ativo, exceto CSP (desabilitada porque o frontend usa scripts/estilos inline do AngularJS).
- `cors` restrito a `ALLOWED_ORIGIN` (lista separada por vírgula) quando definida; sem a env, libera qualquer origem — configurar em produção.
- `express-rate-limit` aplicado em `POST /api/auth/login` (`loginLimiter`): 10 tentativas por 15 min por IP.
