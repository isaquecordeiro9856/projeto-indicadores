const pool = require('../config/database');
const logger = require('../config/logger');

async function buscarPorLogin(nm_usuario) {
  const result = await pool.query(
    `SELECT u.nm_usuario, u.ds_usuario, u.ds_senha, u.ie_situacao,
            u.cd_perfil_inicial, u.cd_setor_atendimento, u.cd_estabelecimento,
            u.cd_pessoa_fisica, u.ie_profissional,
            EXISTS (
              SELECT 1 FROM ods.medico m
               WHERE m.cd_pessoa_fisica = u.cd_pessoa_fisica AND m.ie_situacao = 'A'
            ) AS ie_medico
       FROM ods.usuario u
      WHERE u.nm_usuario = $1`,
    [nm_usuario]
  );
  return result.rows[0] || null;
}

async function validarCredenciais(nm_usuario, ds_senha) {
  const usuario = await buscarPorLogin(nm_usuario);
  if (!usuario) return { valido: false, erro: 'Credenciais inválidas' };

  if (usuario.ie_situacao !== 'A') {
    return { valido: false, erro: 'Usuário inativo' };
  }

  if (process.env.DEV_MODE === 'true') {
    logger.debug({ nm_usuario }, '[DEV MODE] Bypass de senha ativo');
    return { valido: true, usuario };
  }

  // Comparação em texto puro é intencional: o banco ODS é somente leitura e o
  // hash de senha usado pelo TASY é desconhecido, então não há como recriar o
  // hash aqui para comparar. Ver CLAUDE.md.
  if (usuario.ds_senha !== ds_senha) {
    return { valido: false, erro: 'Credenciais inválidas' };
  }

  return { valido: true, usuario };
}

module.exports = { buscarPorLogin, validarCredenciais };
