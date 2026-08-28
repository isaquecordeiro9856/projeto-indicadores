/* ============================================================= */
/* API SERVICE UNIVERSAL — TASY Analytics                         */
/* Detecta o domain pela URL e configura o endpoint correto.     */
/* Suporta: medico, financeiro, enfermagem, farmacia,            */
/*          centrocirurgico, fisioterapia                         */
/* ============================================================= */
(function () {
  'use strict';

  var pathname = window.location.pathname.toLowerCase();

  // DETECÇÃO DE DOMAIN
  var DOMAIN = pathname.indexOf('financeiro')      !== -1 ? 'financeiro'
    : pathname.indexOf('enfermagem')               !== -1 ? 'enfermagem'
    : pathname.indexOf('farmacia')                 !== -1 ? 'farmacia'
    : pathname.indexOf('centrocirurgico')          !== -1 ? 'centrocirurgico'
    : pathname.indexOf('fisioterapia')             !== -1 ? 'fisioterapia'
    : 'medico';

  // MAPEAMENTO domain → endpoint
  var ENDPOINTS = {
    medico:          '/api/pempfrg',
    financeiro:      '/api/glosas',
    enfermagem:      '/api/etapa',
    farmacia:        '/api/farmacia',
    centrocirurgico: '/api/centrocirurgico',
    fisioterapia:    '/api/fisioterapia'
  };

  var ENDPOINT = ENDPOINTS[DOMAIN];

  // DIMENSÕES VÁLIDAS POR DOMAIN
  var DIMENSOES = {
    medico:          ['convenio', 'setor', 'medico_executor', 'procedimento', 'mes'],
    financeiro:      ['convenio', 'estabelecimento', 'setor', 'tipo_convenio', 'tipo_protocolo', 'mes'],
    enfermagem:      ['convenio', 'estabelecimento', 'motivo_devolucao', 'mes'],
    farmacia:        ['material', 'setor', 'mes', 'antibiotico'],
    centrocirurgico: ['procedimento', 'convenio', 'setor', 'medico', 'porte', 'mes'],
    fisioterapia:    ['procedimento', 'convenio', 'setor', 'medico', 'mes']
  };

  // INDICADORES VÁLIDOS POR DOMAIN
  var INDICADORES = {
    medico:          ['todos', 'qtd_contas', 'qtd_procedimentos', 'valor_produzido', 'valor_medico'],
    financeiro:      ['todos', 'valor_faturado', 'valor_recebido', 'valor_a_receber', 'valor_glosado',
                      'valor_glosa_aceita', 'valor_reapresentado', 'valor_adicional', 'valor_retorno',
                      'pct_recebido', 'pct_glosado', 'pct_glosa_aceita', 'pct_adicional'],
    enfermagem:      ['todos', 'qtd_contas', 'dias_etapa', 'media_etapa', 'vl_conta'],
    farmacia:        ['todos', 'qtd_prescricoes', 'qtd_pacientes', 'qtd_materiais'],
    centrocirurgico: ['todos', 'qtd_contas', 'qtd_procedimentos', 'valor_produzido'],
    fisioterapia:    ['todos', 'qtd_contas', 'qtd_atendimentos', 'valor_produzido', 'valor_medico']
  };

  // CONFIGURAÇÃO DE INDICADORES (formatação, cores, badges)
  var CONFIG_INDICADORES = {
    qtd_contas:         { nome: 'Qtd. Atendimentos',    isMoeda: false, isPercentual: false, inverterDelta: false, badgeClass: 'badge-qtd-contas',       color: '#475569' },
    qtd_procedimentos:  { nome: 'Qtd. Procedimentos',   isMoeda: false, isPercentual: false, inverterDelta: false, badgeClass: 'badge-qtd-proc',          color: '#0284c7' },
    qtd_atendimentos:   { nome: 'Atendimentos Fisio',   isMoeda: false, isPercentual: false, inverterDelta: false, badgeClass: 'badge-qtd-proc',          color: '#0284c7' },
    valor_produzido:    { nome: 'Valor Produzido',       isMoeda: true,  isPercentual: false, inverterDelta: false, badgeClass: 'badge-val-produzido',     color: '#d97706' },
    valor_medico:       { nome: 'Repasse Medico',        isMoeda: true,  isPercentual: false, inverterDelta: false, badgeClass: 'badge-val-medico',        color: '#9333ea' },
    valor_faturado:     { nome: 'Valor Faturado',        isMoeda: true,  isPercentual: false, inverterDelta: false, badgeClass: 'badge-val-faturado',      color: '#3b82f6' },
    valor_recebido:     { nome: 'Valor Recebido',        isMoeda: true,  isPercentual: false, inverterDelta: false, badgeClass: 'badge-val-recebido',      color: '#22c55e' },
    valor_a_receber:    { nome: 'Valor a Receber',       isMoeda: true,  isPercentual: false, inverterDelta: false, badgeClass: 'badge-val-a-receber',     color: '#06b6d4' },
    valor_glosado:      { nome: 'Valor Glosado',         isMoeda: true,  isPercentual: false, inverterDelta: true,  badgeClass: 'badge-val-glosado',       color: '#ef4444' },
    valor_glosa_aceita: { nome: 'Glosa Aceita',          isMoeda: true,  isPercentual: false, inverterDelta: true,  badgeClass: 'badge-val-glosa-aceita',  color: '#f87171' },
    valor_reapresentado:{ nome: 'Reapresentado',         isMoeda: true,  isPercentual: false, inverterDelta: false, badgeClass: 'badge-val-reapresentado', color: '#f59e0b' },
    valor_adicional:    { nome: 'Valor Adicional',       isMoeda: true,  isPercentual: false, inverterDelta: false, badgeClass: 'badge-val-adicional',     color: '#ec4899' },
    valor_retorno:      { nome: 'Valor Retorno',         isMoeda: true,  isPercentual: false, inverterDelta: false, badgeClass: 'badge-val-retorno',       color: '#14b8a6' },
    pct_recebido:       { nome: '% Recebido',            isMoeda: false, isPercentual: true,  inverterDelta: false, badgeClass: 'badge-pct-recebido',      color: '#22c55e' },
    pct_glosado:        { nome: '% Glosado',             isMoeda: false, isPercentual: true,  inverterDelta: true,  badgeClass: 'badge-pct-glosado',       color: '#ef4444' },
    pct_glosa_aceita:   { nome: '% Glosa Aceita',        isMoeda: false, isPercentual: true,  inverterDelta: true,  badgeClass: 'badge-pct-glosa-aceita',  color: '#f87171' },
    pct_adicional:      { nome: '% Adicional',           isMoeda: false, isPercentual: true,  inverterDelta: false, badgeClass: 'badge-pct-adicional',     color: '#a78bfa' },
    dias_etapa:         { nome: 'Dias em Etapa',         isMoeda: false, isPercentual: false, inverterDelta: true,  badgeClass: 'badge-qtd-contas',        color: '#6366f1' },
    media_etapa:        { nome: 'Media Etapa (dias)',    isMoeda: false, isPercentual: false, inverterDelta: true,  badgeClass: 'badge-qtd-proc',          color: '#8b5cf6' },
    vl_conta:           { nome: 'Valor Conta',           isMoeda: true,  isPercentual: false, inverterDelta: false, badgeClass: 'badge-val-produzido',     color: '#f59e0b' },
    qtd_prescricoes:    { nome: 'Prescricoes',           isMoeda: false, isPercentual: false, inverterDelta: false, badgeClass: 'badge-qtd-contas',        color: '#10b981' },
    qtd_pacientes:      { nome: 'Pacientes',             isMoeda: false, isPercentual: false, inverterDelta: false, badgeClass: 'badge-qtd-proc',          color: '#0284c7' },
    qtd_materiais:      { nome: 'Materiais Distintos',   isMoeda: false, isPercentual: false, inverterDelta: false, badgeClass: 'badge-val-produzido',     color: '#7c3aed' },
    taxa_glosa:         { nome: '% Glosa',               isMoeda: false, isPercentual: true,  inverterDelta: true,  badgeClass: 'badge-glosa-rate',        color: '#ef4444' }
  };

  // RÓTULOS DE DIMENSÃO
  var NOMES_DIMENSAO = {
    convenio:         'Convenio',
    estabelecimento:  'Estabelecimento',
    setor:            'Setor',
    tipo_convenio:    'Tipo Convenio',
    tipo_protocolo:   'Tipo Protocolo',
    medico_executor:  'Medico Executor',
    medico:           'Profissional',
    procedimento:     'Procedimento',
    mes:              'Mes',
    motivo_devolucao: 'Motivo Devolucao',
    material:         'Material / Medicamento',
    antibiotico:      'Tipo (Antibiotico)',
    porte:            'Porte Cirurgico'
  };

  // ANGULAR FACTORY
  angular.module('DashboardApp').factory('ApiService', function ($http, $q) {

    function getAuthHeaders() {
      var token = localStorage.getItem('tasy_token');
      return token ? { 'Authorization': 'Bearer ' + token } : {};
    }

    function handleAuthError(response) {
      if (response.status === 401) {
        window.location.href = 'login.html';
      }
      return $q.reject(response);
    }

    function buscarDados(modulo, params) {
      return $http.post('/api/' + modulo, params, {
        headers: getAuthHeaders(),
        timeout: 30000
      }).then(function (response) {
        return response.data;
      }, handleAuthError);
    }

    function adaptarRequisicao(req) {
      var dimensao  = req.dimensao;
      var indicador = req.indicador;
      var dimValidas = DIMENSOES[DOMAIN] || [];
      var indValidos = INDICADORES[DOMAIN] || [];
      if (dimValidas.indexOf(dimensao) === -1) dimensao  = dimValidas[0] || 'convenio';
      if (indValidos.indexOf(indicador) === -1) indicador = 'todos';
      return angular.extend({}, req, { dimensao: dimensao, indicador: indicador, dashboard: DOMAIN });
    }

    function obterDadosDashboard(req) {
      var token = localStorage.getItem('tasy_token');
      var headers = token ? { Authorization: 'Bearer ' + token } : {};
      return $http.post(ENDPOINT, adaptarRequisicao(req), { timeout: 120000, headers: headers })
        .then(function (response) { return response.data; },
        function (response) {
          var msg = (response && response.data && response.data.mensagem)
            ? response.data.mensagem : ('Erro HTTP ' + (response && response.status));
          if (response && response.status === 401) window.location.href = 'login.html';
          return $q.reject(new Error(msg));
        });
    }

    return {
      obterDadosDashboard:   obterDadosDashboard,
      getConfigIndicadores:  function () { return CONFIG_INDICADORES; },
      getNomesDimensao:      function () { return NOMES_DIMENSAO;     },
      getDomain:             function () { return DOMAIN;             },
      getDimensoesValidas:   function () { return DIMENSOES[DOMAIN] || []; },
      getIndicadoresValidos: function () { return INDICADORES[DOMAIN] || []; },
      isMock:                function () { return false; },
      buscarDados: buscarDados,
      getModulos: {
        glosas:          function (p) { return buscarDados('glosas',          p); },
        etapa:           function (p) { return buscarDados('etapa',           p); },
        pempfrg:         function (p) { return buscarDados('pempfrg',         p); },
        farmacia:        function (p) { return buscarDados('farmacia',        p); },
        centrocirurgico: function (p) { return buscarDados('centrocirurgico', p); },
        fisioterapia:    function (p) { return buscarDados('fisioterapia',    p); }
      },
      getUsuario: function () { var u = localStorage.getItem('tasy_usuario'); return u ? JSON.parse(u) : null; },
      getPerfil:  function () { var p = localStorage.getItem('tasy_perfil');  return p ? JSON.parse(p) : null; }
    };
  });

}());