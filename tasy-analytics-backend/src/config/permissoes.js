const { ehSupervisor, ehDirecao } = require('./supervisao');

// ═══════════════════════════════════════════════════════════
// PERMISSÕES — só supervisão e direção acessam o sistema
// ═══════════════════════════════════════════════════════════
// Usuário comum (assistencial/operacional) não tem acesso: nem login, nem
// painel, nem API. Por isso não existe mais mapa de perfil→dashboards nem
// fallback por setor — quem é supervisor vê todos os painéis de área (ele
// já enxerga todas as linhas dos dados, ver services/escopoAcesso.js), e a
// direção soma a esses o Painel Geral consolidado.

const DASHBOARDS_AREA = ['enfermagem', 'medico', 'farmacia', 'financeiro', 'centrocirurgico', 'fisioterapia'];
const DASHBOARD_GERAL = 'geral';

// Descrição do perfil do Tasy, só para exibição no cabeçalho/hub.
// A tabela ods.perfil não é replicada no ODS.
const DESCRICOES_PERFIL = {
  1848: 'Admin - Auditoria',
  1912: 'Manutenção - Supervisão',
  1999: 'Oncologia - Supervisão',
  2035: 'Recepção Serviços - Supervisão',
  2118: 'Higienização - Supervisão',
  2138: 'Recepção Consultas - Supervisão',
  2140: 'Recepção Exames - Supervisão',
  2142: 'Recepção Internação - Supervisão',
  2144: 'Recepção PA - Supervisão',
  2166: 'Nutrição - Supervisão',
  2168: 'Almoxarifado - Supervisão',
  2199: 'Patrimônio - Supervisão',
  2209: 'Rouparia - Supervisão',
  2223: 'SAME - Supervisão',
  2234: 'Financeiro - Supervisão',
  2239: 'Qualidade - Supervisão',
  2243: 'Retorno de Convênio - Supervisão',
  2247: 'Faturamento SUS - Supervisão',
  2257: 'Repasse para Terceiros - Supervisão',
  2271: 'Fiscal - Supervisão',
  2285: 'Enfermagem - Supervisão CPOE',
  2299: 'Recepção Laboratório - Supervisão',
  2306: 'Radioterapia - Supervisão',
  2317: 'Recepção - Consultório Supervisão',
  2374: 'Radioterapia - Supervisão',
  2421: 'Financeiro - Supervisão UN2',
  2425: 'Recepção Amb SUS - Supervisão'
};

const SEM_ACESSO = {
  descricao: 'Sem acesso',
  nivel: 'sem_acesso',
  dashboards: [],
  exportar: false,
  configurar: false,
  supervisor: false,
  direcao: false,
  escopo: 'nenhum'
};

function resolverPermissao(usuario) {
  if (!usuario) return SEM_ACESSO;

  if (ehDirecao(usuario)) {
    return {
      descricao: DESCRICOES_PERFIL[usuario.cd_perfil_inicial] || 'Direção',
      nivel: 'direcao',
      dashboards: DASHBOARDS_AREA.concat([DASHBOARD_GERAL]),
      exportar: true,
      configurar: true,
      supervisor: true,
      direcao: true,
      escopo: 'global'
    };
  }

  if (ehSupervisor(usuario)) {
    return {
      descricao: DESCRICOES_PERFIL[usuario.cd_perfil_inicial] || 'Supervisão',
      nivel: 'supervisor',
      dashboards: DASHBOARDS_AREA.slice(),
      exportar: true,
      configurar: true,
      supervisor: true,
      direcao: false,
      escopo: 'global'
    };
  }

  return SEM_ACESSO;
}

function temAcesso(usuario) {
  return resolverPermissao(usuario).dashboards.length > 0;
}

module.exports = {
  DASHBOARDS_AREA,
  DASHBOARD_GERAL,
  DESCRICOES_PERFIL,
  SEM_ACESSO,
  resolverPermissao,
  temAcesso
};
