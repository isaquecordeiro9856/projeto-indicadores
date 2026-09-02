const jwt = require('jsonwebtoken');
const { validarCredenciais } = require('../services/usuarioService');
const { resolverPermissao } = require('../config/permissoes');
const logger = require('../config/logger');

const MSG_SEM_ACESSO = 'Acesso restrito à supervisão e à direção. Fale com o administrador do sistema.';

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
      logger.debug({ nm_usuario: usuario.nm_usuario }, '[DEV MODE] Atribuindo perfil Admin (1848) ao usuario');
    }

    const perfil = resolverPermissao(usuario);

    // Sistema restrito a supervisão/direção: usuário comum não recebe token.
    if (!perfil.dashboards.length) {
      return res.status(403).json({ mensagem: MSG_SEM_ACESSO });
    }

    const token = jwt.sign(
      {
        nm_usuario: usuario.nm_usuario,
        cd_perfil_inicial: usuario.cd_perfil_inicial,
        ds_usuario: usuario.ds_usuario,
        cd_setor_atendimento: usuario.cd_setor_atendimento,
        cd_estabelecimento: usuario.cd_estabelecimento,
        cd_pessoa_fisica: usuario.cd_pessoa_fisica,
        ie_profissional: usuario.ie_profissional,
        ie_medico: !!usuario.ie_medico
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
    logger.error({ err: error }, 'Erro no login');
    res.status(500).json({ mensagem: 'Erro interno do servidor' });
  }
}

async function me(req, res) {
  try {
    const perfil = resolverPermissao(req.usuario);

    // Token emitido antes de o acesso ser revogado (ex.: perfil saiu da
    // lista de supervisão) deixa de valer aqui, não só nos dashboards.
    if (!perfil.dashboards.length) {
      return res.status(403).json({ mensagem: MSG_SEM_ACESSO });
    }

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
    logger.error({ err: error }, 'Erro ao retornar dados do usuário');
    res.status(500).json({ mensagem: 'Erro interno do servidor' });
  }
}

module.exports = { login, me };
