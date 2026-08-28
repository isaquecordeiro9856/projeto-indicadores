const MAPA_PERFIS = {
  // ═══════════════════════════════════════════════════════
  // ADMIN - ACESSO TOTAL
  // ═══════════════════════════════════════════════════════
  1848: {
    descricao: 'Admin - Auditoria',
    dashboards: ['enfermagem', 'medico', 'farmacia', 'financeiro', 'centrocirurgico', 'fisioterapia'],
    exportar: true,
    configurar: true
  },

  // ═══════════════════════════════════════════════════════
  // ENFERMAGEM
  // ═══════════════════════════════════════════════════════
  2286: {
    descricao: 'Enfermagem - Técnico CPOE',
    dashboards: ['enfermagem', 'financeiro', 'medico'],
    exportar: true,
    configurar: false
  },
  2283: {
    descricao: 'Enfermagem - Internação CPOE',
    dashboards: ['enfermagem', 'financeiro', 'medico'],
    exportar: true,
    configurar: false
  },
  2158: {
    descricao: 'Enfermagem - Setor 34',
    dashboards: ['enfermagem', 'financeiro', 'medico'],
    exportar: true,
    configurar: false
  },

  // ═══════════════════════════════════════════════════════
  // MÉDICOS
  // ═══════════════════════════════════════════════════════
  2279: {
    descricao: 'Médico - Internação CPOE',
    dashboards: ['medico', 'financeiro', 'enfermagem'],
    exportar: true,
    configurar: true
  },
  2281: {
    descricao: 'Médico - Ambulatório',
    dashboards: ['medico', 'financeiro', 'enfermagem'],
    exportar: true,
    configurar: false
  },

  // ═══════════════════════════════════════════════════════
  // FARMÁCIA
  // ═══════════════════════════════════════════════════════
  2169: {
    descricao: 'Farmácia Operacional',
    dashboards: ['farmacia', 'medico'],
    exportar: true,
    configurar: false
  },
  2170: {
    descricao: 'Farmacêutico',
    dashboards: ['farmacia', 'medico'],
    exportar: true,
    configurar: false
  },

  // ═══════════════════════════════════════════════════════
  // FISIOTERAPEUTA
  // ═══════════════════════════════════════════════════════
  2353: {
    descricao: 'Fisioterapeuta',
    dashboards: ['fisioterapia', 'enfermagem'],
    exportar: true,
    configurar: false
  },

  // ═══════════════════════════════════════════════════════
  // CENTRO CIRÚRGICO
  // ═══════════════════════════════════════════════════════
  2181: {
    descricao: 'Centro Cirúrgico',
    dashboards: ['centrocirurgico', 'medico'],
    exportar: true,
    configurar: false
  },

  // ═══════════════════════════════════════════════════════
  // ADMINISTRATIVO / FINANCEIRO
  // ═══════════════════════════════════════════════════════
  2149: {
    descricao: 'Administrativo/Financeiro',
    dashboards: ['financeiro', 'medico'],
    exportar: true,
    configurar: true
  },
  2028: {
    descricao: 'Gestão - Setor 30',
    dashboards: ['enfermagem', 'financeiro', 'medico'],
    exportar: true,
    configurar: true
  },
  2143: {
    descricao: 'Administrativo',
    dashboards: ['financeiro', 'medico'],
    exportar: true,
    configurar: false
  },

  // ═══════════════════════════════════════════════════════
  // OUTROS SETORES
  // ═══════════════════════════════════════════════════════
  2356: {
    descricao: 'Setor 9',
    dashboards: ['medico'],
    exportar: false,
    configurar: false
  },
  2251: {
    descricao: 'Setor 37',
    dashboards: ['medico'],
    exportar: false,
    configurar: false
  },
  2173: {
    descricao: 'Setor 41',
    dashboards: [],
    exportar: false,
    configurar: false
  }
};

const DEFAULT_PERMISSAO = {
  descricao: 'Sem acesso',
  dashboards: [],
  exportar: false,
  configurar: false
};

module.exports = { MAPA_PERFIS, DEFAULT_PERMISSAO };
