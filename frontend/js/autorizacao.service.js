angular.module('DashboardApp').factory('AutorizacaoService', function(AuthService) {
  return {
    podeAcessar: function(dashboard) {
      var perfil = AuthService.getPerfil();
      if (!perfil) return false;
      return perfil.dashboards && perfil.dashboards.indexOf(dashboard) !== -1;
    },

    podeExportar: function() {
      var perfil = AuthService.getPerfil();
      return perfil ? !!perfil.exportar : false;
    },

    ehDirecao: function() {
      var perfil = AuthService.getPerfil();
      return perfil ? !!perfil.direcao : false;
    },

    podeConfigurar: function() {
      var perfil = AuthService.getPerfil();
      return perfil ? !!perfil.configurar : false;
    },

    getDashboardsDisponiveis: function() {
      var perfil = AuthService.getPerfil();
      if (!perfil || !perfil.dashboards) return [];

      var todos = [
        { id: 'geral', nome: 'Painel Geral (Direção)', descricao: 'Visão consolidada do hospital: financeiro, atendimentos, ocupação, produção, custos, compras e manutenção', icon: 'G', cssClass: 'icon-geral', arquivo: 'dashboard-geral.html' },
        { id: 'enfermagem', nome: 'Painel Enfermagem', descricao: 'Pacientes, permanência, leitos e assistência de enfermagem', icon: 'E', cssClass: 'icon-enfermagem', arquivo: 'dashboard-enfermagem.html' },
        { id: 'medico', nome: 'Painel Médico', descricao: 'Procedimentos, produtividade médica e repasse', icon: 'M', cssClass: 'icon-medico', arquivo: 'dashboard-medico.html' },
        { id: 'farmacia', nome: 'Painel Farmácia', descricao: 'Materiais, medicamentos e consumo de insumos', icon: 'F', cssClass: 'icon-farmacia', arquivo: 'dashboard-farmacia.html' },
        { id: 'financeiro', nome: 'Painel Financeiro', descricao: 'Faturamento, recebimento, glosas e indicadores financeiros', icon: '$', cssClass: 'icon-financeiro', arquivo: 'dashboard-financeiro.html' },
        { id: 'centrocirurgico', nome: 'Centro Cirúrgico', descricao: 'Cirurgias, salas e procedimentos cirúrgicos', icon: 'C', cssClass: 'icon-centrocirurgico', arquivo: 'dashboard-centrocirurgico.html' },
        { id: 'fisioterapia', nome: 'Fisioterapia', descricao: 'Atendimentos de fisioterapia e internações', icon: 'P', cssClass: 'icon-fisioterapia', arquivo: 'dashboard-fisioterapia.html' }
      ];

      return todos.filter(function(d) {
        return perfil.dashboards.indexOf(d.id) !== -1;
      });
    }
  };
});
