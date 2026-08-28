const pool = require('../config/database');

async function buscarPorLogin(nm_usuario) {
  const result = await pool.query(
    `SELECT nm_usuario, ds_usuario, ds_senha, ie_situacao,
            cd_perfil_inicial, cd_setor_atendimento, cd_estabelecimento,
            cd_pessoa_fisica, ie_profissional
       FROM ods.usuario
      WHERE nm_usuario = $1`,
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
    console.log('[DEV MODE] Bypass de senha ativo para:', nm_usuario);
    return { valido: true, usuario };
  }

  if (usuario.ds_senha !== ds_senha) {
    return { valido: false, erro: 'Credenciais inválidas' };
  }

  return { valido: true, usuario };
}

module.exports = { buscarPorLogin, validarCredenciais };
