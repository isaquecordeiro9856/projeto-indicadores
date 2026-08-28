(function () {
  'use strict';

  var page = window.location.pathname.toLowerCase();
  var domain = page.indexOf('financeiro') !== -1 ? 'financeiro'
    : page.indexOf('enfermagem') !== -1 ? 'enfermagem'
    : page.indexOf('farmacia') !== -1 ? 'farmacia'
    : page.indexOf('centrocirurgico') !== -1 ? 'centrocirurgico'
    : page.indexOf('fisioterapia') !== -1 ? 'fisioterapia' : 'medico';

  var rules = {
    medico: {
      dimensions: ['setor', 'convenio', 'medico_executor', 'procedimento'],
      indicators: ['qtd_contas', 'qtd_procedimentos', 'valor_produzido', 'valor_medico'],
      title: 'Painel Médico',
      tag: 'Produção médica · procedimentos e repasse'
    },
    farmacia: {
      dimensions: ['estabelecimento', 'setor', 'tipo_convenio', 'convenio'],
      indicators: ['qtd_contas', 'qtd_procedimentos', 'qtd_matmed'],
      title: 'Painel de Farmácia',
      tag: 'Consumo · prescrições e materiais'
    },
    centrocirurgico: {
      dimensions: ['procedimentos', 'convenio', 'setor', 'tipo_convenio', 'tipo_atendimento', 'medico_executor'],
      indicators: ['qtd_contas', 'qtd_procedimentos', 'valor_produzido'],
      title: 'Centro Cirúrgico',
      tag: 'Produção · procedimentos cirúrgicos'
    },
    fisioterapia: {
      dimensions: ['procedimentos', 'convenio', 'setor', 'tipo_convenio', 'medico_executor'],
      indicators: ['qtd_contas', 'qtd_procedimentos', 'valor_produzido'],
      title: 'Painel de Fisioterapia',
      tag: 'Atendimentos · produção fisioterapêutica'
    },
    financeiro: {
      dimensions: ['mes', 'estabelecimento', 'setor', 'convenio', 'tipo_convenio', 'tipo_protocolo'],
      indicators: ['valor_faturado', 'valor_recebido', 'valor_a_receber', 'valor_glosado', 'valor_glosa_aceita', 'valor_reapresentado', 'valor_adicional', 'valor_retorno', 'pct_recebido', 'pct_glosado', 'pct_glosa_aceita', 'pct_adicional'],
      title: 'Painel Financeiro',
      tag: 'Glosas · faturamento e recebimento'
    },
    enfermagem: {
      dimensions: ['convenio', 'estabelecimento', 'motivo_devolucao', 'mes'],
      indicators: ['qtd_contas', 'dias_etapa', 'media_etapa', 'vl_conta'],
      title: 'Painel de Enfermagem',
      tag: 'Permanência · contas e assistência'
    }
  }[domain];

  var token = localStorage.getItem('tasy_token');
  var perfil;
  try {
    perfil = JSON.parse(localStorage.getItem('tasy_perfil') || 'null');
  } catch (error) {
    perfil = null;
  }
  if (!token) {
    window.location.replace('login.html');
    return;
  }
  if (!perfil || !Array.isArray(perfil.dashboards) || perfil.dashboards.indexOf(domain) === -1) {
    window.location.replace('hub.html');
    return;
  }

  document.documentElement.setAttribute('data-dashboard-domain', domain);

  function filterItems() {
    document.querySelectorAll('[ng-click*="selecionarDimensao"]').forEach(function (item) {
      var match = item.getAttribute('ng-click').match(/'([^']+)'/);
      item.hidden = !match || rules.dimensions.indexOf(match[1]) === -1;
    });
    document.querySelectorAll('[ng-click*="selecionarIndicador"]').forEach(function (item) {
      var match = item.getAttribute('ng-click').match(/'([^']+)'/);
      item.hidden = !match || rules.indicators.indexOf(match[1]) === -1;
    });
    document.querySelectorAll('.pill-filter').forEach(function (item) {
      var expression = item.getAttribute('ng-click') || '';
      if (domain === 'financeiro') item.hidden = expression.indexOf("'glosas_vs_recuperacao'") === -1 && expression.indexOf("'todos'") === -1;
      else if (domain === 'enfermagem') item.hidden = expression.indexOf("'etapa'") === -1 && expression.indexOf("'contas'") === -1 && expression.indexOf("'todos'") === -1;
      else item.hidden = expression.indexOf("'todos'") === -1 && expression.indexOf("'financeiro'") === -1 && expression.indexOf("'quantidades'") === -1;
    });
    var title = document.querySelector('.brand-tag');
    if (title) title.textContent = rules.tag;
    var heading = document.querySelector('.page-title, .main-title');
    if (heading) heading.textContent = rules.title;
  }

  document.addEventListener('DOMContentLoaded', function () {
    filterItems();
    new MutationObserver(filterItems).observe(document.body, { childList: true, subtree: true });
  });
}());
