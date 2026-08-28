const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { validarCredenciais } = require('../services/usuarioService');
const { resetSenha } = require('../services/resetSenha');
const { MAPA_PERFIS, DEFAULT_PERMISSAO } = require('../config/permissoes');

async function login(req, res) {
  try {
    const { nm_usuario, ds_senha } = req.body;

    if (!nm_usuario || !ds_senha) {
      return res.status(400).json({ mensagem: 'Login e senha são obrigatórios' });
    }

    const resultado = await validarCredenciais(nm_usuario, ds_senha);

    if (!resultado.valido) {
      return res.status(401).json({ mensagem: resultado.erro });
    }

    const { usuario } = resultado;

    // DEV_MODE: se usuario nao tem perfil, atribui Admin (1848) para testes
    if (process.env.DEV_MODE === 'true' && !usuario.cd_perfil_inicial) {
      usuario.cd_perfil_inicial = 1848;
      console.log('[DEV MODE] Atribuindo perfil Admin (1848) ao usuario:', usuario.nm_usuario);
    }

    const perfil = MAPA_PERFIS[usuario.cd_perfil_inicial] || DEFAULT_PERMISSAO;

    const token = jwt.sign(
      {
        nm_usuario: usuario.nm_usuario,
        cd_perfil_inicial: usuario.cd_perfil_inicial,
        ds_usuario: usuario.ds_usuario,
        cd_setor_atendimento: usuario.cd_setor_atendimento,
        cd_estabelecimento: usuario.cd_estabelecimento,
        cd_pessoa_fisica: usuario.cd_pessoa_fisica,
        ie_profissional: usuario.ie_profissional
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION || '8h' }
    );

    res.json({
      token,
      usuario: {
        nm_usuario: usuario.nm_usuario,
        ds_usuario: usuario.ds_usuario,
        cd_perfil_inicial: usuario.cd_perfil_inicial,
        cd_setor_atendimento: usuario.cd_setor_atendimento,
        cd_estabelecimento: usuario.cd_estabelecimento
      },
      perfil
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ mensagem: 'Erro interno do servidor' });
  }
}

async function me(req, res) {
  try {
    const perfil = MAPA_PERFIS[req.usuario.cd_perfil_inicial] || DEFAULT_PERMISSAO;

    res.json({
      usuario: {
        nm_usuario: req.usuario.nm_usuario,
        ds_usuario: req.usuario.ds_usuario,
        cd_perfil_inicial: req.usuario.cd_perfil_inicial,
        cd_setor_atendimento: req.usuario.cd_setor_atendimento,
        cd_estabelecimento: req.usuario.cd_estabelecimento,
        cd_pessoa_fisica: req.usuario.cd_pessoa_fisica,
        ie_profissional: req.usuario.ie_profissional
      },
      perfil
    });
  } catch (error) {
    console.error('Erro ao retornar dados do usuário:', error);
    res.status(500).json({ mensagem: 'Erro interno do servidor' });
  }
}

async function resetSenhaTemp(req, res) {
  try {
    const { nm_usuario, nova_senha } = req.body;
    if (!nm_usuario || !nova_senha) {
      return res.status(400).json({ mensagem: 'nm_usuario e nova_senha são obrigatórios' });
    }
    const result = await resetSenha(pool, nm_usuario, nova_senha);
    res.json({ mensagem: 'Senha alterada para ' + result.usuario, novoHash: result.novoHash });
  } catch (error) {
    console.error('Erro ao resetar senha:', error);
    res.status(500).json({ mensagem: error.message });
  }
}

module.exports = { login, me, resetSenhaTemp };
