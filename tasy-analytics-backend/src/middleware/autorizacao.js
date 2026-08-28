const { MAPA_PERFIS, DEFAULT_PERMISSAO } = require('../config/permissoes');

const MODULO_PARA_DASHBOARD = {
  glosas: ['financeiro'],
  etapa: ['enfermagem'],
  pempfrg: ['medico', 'farmacia', 'centrocirurgico', 'fisioterapia'],
  farmacia: ['farmacia'],
  centrocirurgico: ['centrocirurgico'],
  fisioterapia: ['fisioterapia']
};

function autorizar(modulo, dashboard) {
  return (req, res, next) => {
    const perfil = MAPA_PERFIS[req.usuario.cd_perfil_inicial] || DEFAULT_PERMISSAO;
    const dashboardSolicitado = typeof dashboard === 'function' ? dashboard(req) : dashboard;
    const dashboardsNecessarios = dashboardSolicitado
      ? [dashboardSolicitado]
      : MODULO_PARA_DASHBOARD[modulo] || [modulo];
    if (dashboardSolicitado && !MODULO_PARA_DASHBOARD[modulo].includes(dashboardSolicitado)) {
      return res.status(400).json({ mensagem: 'Dashboard inválido para o módulo: ' + modulo });
    }
    const temAcesso = dashboardsNecessarios.some(function(d) {
      return perfil.dashboards.includes(d);
    });

    if (!temAcesso) {
      return res.status(403).json({
        mensagem: 'Acesso não autorizado ao dashboard: ' + modulo
      });
    }

    req.perfil = perfil;
    next();
  };
}

module.exports = { autorizar };
