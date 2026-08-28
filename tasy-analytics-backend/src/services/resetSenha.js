const crypto = require('crypto');

async function resetSenha(pool, nm_usuario, novaSenha) {
  const hash = crypto.createHash('sha256').update(novaSenha).digest('hex');
  const result = await pool.query(
    "UPDATE ods.usuario SET ds_senha = $1 WHERE nm_usuario = $2 RETURNING nm_usuario",
    [hash, nm_usuario]
  );
  if (result.rows.length === 0) {
    throw new Error('Usuário não encontrado: ' + nm_usuario);
  }
  return { usuario: result.rows[0].nm_usuario, novoHash: hash };
}

module.exports = { resetSenha };
