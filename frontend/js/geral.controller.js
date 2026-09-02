/* =============================================================
   PAINEL GERAL DA DIREÇÃO — controller
   -------------------------------------------------------------
   Nada de dimensão ou indicador é hardcoded aqui: o menu vem de
   GET /api/geral/catalogo e cada resposta de POST /api/geral traz
   de novo a lista de indicadores válidos daquela dimensão. Fonte
   nova no backend aparece sozinha nesta tela.

   Preferências (tema, views, metas, favoritos, colunas) ficam em
   localStorage sob o prefixo PREF — sempre com 'geral' no nome
   para não vazar para os 6 painéis de área, que usam o prefixo
   'tasy_dashboard_<domain>'.
   ============================================================= */
angular.module('GeralApp', [])

// jqLite.css() faz element.style[nome] = valor, o que NÃO funciona para
// custom properties (--cor-x): elas exigem style.setProperty. Por isso o
// ng-style não serve para passar cor de grupo/indicador para o CSS —
// esta diretiva faz o setProperty na mão.
.directive('varCss', function () {
  return {
    restrict: 'A',
    link: function (scope, el, attrs) {
      scope.$watch(function () { return scope.$eval(attrs.varCss); }, function (mapa) {
        if (!mapa) return;
        Object.keys(mapa).forEach(function (nome) {
          if (mapa[nome] != null) el[0].style.setProperty(nome, mapa[nome]);
        });
      }, true);
    }
  };
})

.controller('GeralController',
function ($scope, $http, $timeout, $document) {
  'use strict';

  var API = '/api/geral';
  var PREF = 'tasy_geral_';

  // ══════════════════════════════════════════════════════════
  // Popover "origem dos dados" — mesmo padrão do dashboard.controller.js
  // ══════════════════════════════════════════════════════════
  $scope.origemAberta = null;

  $scope.abrirOrigem = function (evento, origemDados, chave) {
    evento.stopPropagation();
    if (!origemDados) return;
    var el = evento.currentTarget;
    if ($scope.origemAberta && $scope.origemAberta._el === el) {
      $scope.origemAberta = null;
      return;
    }
    var rect = el.getBoundingClientRect();
    var largura = 320;
    var left = Math.min(rect.left, window.innerWidth - largura - 12);
    left = Math.max(left, 12);
    // O verbete do dicionário responde "o que é este número" antes de
    // "de onde ele sai" — é a pergunta que a direção faz primeiro.
    var verbete = (chave && $scope.dicionario[chave]) || null;
    $scope.origemAberta = {
      _el: el,
      top: rect.bottom + 6,
      left: left,
      nome: verbete ? verbete.nome : null,
      desc: verbete ? verbete.desc : null,
      formula: verbete ? verbete.formula : null,
      tabelas: origemDados.tabelas || [],
      campo: chave && origemDados.campos ? origemDados.campos[chave] : null,
      filtro: origemDados.filtro || ''
    };
  };

  $scope.fecharOrigem = function () {
    $scope.origemAberta = null;
  };

  $document.on('click', function () {
    if ($scope.origemAberta) $scope.$apply($scope.fecharOrigem);
  });
  $document.on('keydown', function (evento) {
    if (evento.key === 'Escape' && $scope.origemAberta) $scope.$apply($scope.fecharOrigem);
  });

  // ══════════════════════════════════════════════════════════
  // Infra: storage, http, toast
  // ══════════════════════════════════════════════════════════
  function ler(chave, padrao) {
    try {
      var v = localStorage.getItem(PREF + chave);
      return v === null ? padrao : JSON.parse(v);
    } catch (e) { return padrao; }
  }
  function gravar(chave, valor) {
    try { localStorage.setItem(PREF + chave, JSON.stringify(valor)); }
    catch (e) { console.warn('[geral] não foi possível gravar ' + chave, e && e.name); }
  }

  // ══════════════════════════════════════════════════════════
  // Cache stale-while-revalidate
  // ══════════════════════════════════════════════════════════
  // A abertura do painel esperava 30-40s de tela vazia. Agora pinta a
  // última resposta salva na hora e revalida por cima. Regras que não
  // podem ser afrouxadas:
  //  · VERSAO_CACHE acompanha o ?v= do <script>: deploy invalida tudo.
  //  · Só é aplicado UMA vez, no boot. Resposta real sempre sobrescreve.
  //  · Gravar dentro do .then, ANTES de atribuir ao $scope: depois que o
  //    ng-repeat roda, o Angular carimba $$hashKey nas linhas e o cache
  //    volta com lixo que pode virar ngRepeat:dupes.
  //  · Teto de linhas e de bytes: 999 linhas comparadas de uma fonte com
  //    14 indicadores dão ~3,5 MB, e o orçamento de ~5 MB da origem é
  //    dividido com os caches dos 6 painéis de área.
  var VERSAO_CACHE = '4';
  var TTL_CACHE = 24 * 60 * 60 * 1000;
  var MAX_LINHAS_CACHE = 250;
  var MAX_BYTES_CACHE = 400 * 1024;
  var PREFIXO_CACHE = 'cache_';

  function purgarCache() {
    try {
      Object.keys(localStorage)
        .filter(function (k) { return k.indexOf(PREF + PREFIXO_CACHE) === 0; })
        .forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) { /* storage indisponível */ }
  }

  function gravarCache(chave, sig, dados) {
    var pacote = JSON.stringify({ v: VERSAO_CACHE, sig: sig, quando: Date.now(), res: dados });
    if (pacote.length > MAX_BYTES_CACHE) return;
    try { localStorage.setItem(PREF + PREFIXO_CACHE + chave, pacote); }
    catch (e) {
      // Cota estourada: limpa só os caches (nunca as preferências) e
      // tenta uma vez. Se falhar de novo, segue sem cache.
      purgarCache();
      try { localStorage.setItem(PREF + PREFIXO_CACHE + chave, pacote); } catch (e2) { /* desiste */ }
    }
  }

  function lerCache(chave, sig) {
    var bruto;
    try { bruto = localStorage.getItem(PREF + PREFIXO_CACHE + chave); } catch (e) { return null; }
    if (!bruto) return null;
    var p;
    try { p = JSON.parse(bruto); } catch (e) { return null; }
    if (!p || p.v !== VERSAO_CACHE) return null;
    if (Date.now() - p.quando > TTL_CACHE) return null;
    if (sig != null && p.sig !== sig) return null;
    return p;
  }

  function podarParaCache(res) {
    if (!res || !res.dados || res.dados.length <= MAX_LINHAS_CACHE) return res;
    return angular.extend({}, res, { dados: res.dados.slice(0, MAX_LINHAS_CACHE), parcial: true });
  }

  function assinaturaPeriodo() {
    var p = periodo();
    return [p.tipoPeriodo, p.periodoValor, $scope.comparar ? 1 : 0].join('|');
  }
  function assinaturaDados() {
    return [
      $scope.dimensao ? $scope.dimensao.id : '', $scope.indicador,
      $scope.ordem, $scope.limite, assinaturaPeriodo()
    ].join('|');
  }

  function quandoRelativo(ts) {
    var min = Math.round((Date.now() - ts) / 60000);
    if (min < 1) return 'agora há pouco';
    if (min < 60) return 'há ' + min + ' min';
    var h = Math.round(min / 60);
    return h < 24 ? 'há ' + h + 'h' : 'ontem';
  }

  // A faixa "mostrando a consulta salva" fica na tela enquanto QUALQUER
  // coisa estiver revalidando: some só quando todos os pedidos voltam.
  function marcarCache(quando) {
    if (!$scope.doCache || quando < $scope.doCache.ts) {
      $scope.doCache = { ts: quando, quando: quandoRelativo(quando) };
    }
  }
  function limparCacheSeTudoCarregado() {
    if ($scope.carregando.blocos <= 0 && !$scope.carregando.dados && !$scope.carregando.evolucao) {
      $scope.doCache = null;
    }
  }

  function headers() {
    var t = localStorage.getItem('tasy_token');
    return t ? { Authorization: 'Bearer ' + t } : {};
  }

  function sair() {
    // O painel cobre o hospital inteiro: o cache não pode sobreviver ao
    // logout numa máquina compartilhada.
    purgarCache();
    ['tasy_token', 'tasy_usuario', 'tasy_perfil'].forEach(function (k) { localStorage.removeItem(k); });
    window.location.replace('login.html');
  }
  $scope.sair = sair;

  function erroDe(resp) {
    if (resp && resp.status === 401) { sair(); return 'Sessão expirada.'; }
    if (resp && resp.status === 403) return (resp.data && resp.data.mensagem) || 'Painel restrito à direção.';
    if (resp && resp.status === -1) return 'Sem resposta do servidor (consulta muito longa ou conexão caiu).';
    return (resp && resp.data && resp.data.mensagem) || 'Erro ao consultar o servidor.';
  }

  var timerToast = null;
  $scope.toast = null;
  function toast(msg, tipo) {
    $scope.toast = { msg: msg, tipo: tipo || 'ok' };
    if (timerToast) $timeout.cancel(timerToast);
    timerToast = $timeout(function () { $scope.toast = null; }, 2600);
  }
  $scope.mostrarToast = toast;

  // ══════════════════════════════════════════════════════════
  // Estado
  // ══════════════════════════════════════════════════════════
  var anoAtual = new Date().getFullYear();
  var mesAtual = String(new Date().getMonth() + 1).padStart(2, '0');

  $scope.anos = [];
  for (var a = anoAtual; a >= anoAtual - 6; a--) $scope.anos.push(String(a));

  var NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto',
    'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  $scope.meses = [{ valor: '', nome: 'Ano inteiro' }];
  $scope.mesesSemAnoInteiro = [];
  NOMES_MESES.forEach(function (nome, i) {
    var item = { valor: String(i + 1).padStart(2, '0'), nome: nome };
    $scope.meses.push(item);
    $scope.mesesSemAnoInteiro.push(item);
  });

  $scope.ano = String(anoAtual);
  $scope.mes = '';
  $scope.dia = '';
  $scope.abaPeriodo = 'ano';
  $scope.comparar = ler('comparar', true);
  $scope.tema = ler('tema', 'auto');
  $scope.menuAberto = ler('menuAberto', true);
  $scope.compacta = ler('compacta', false);
  $scope.limite = ler('limite', 25);
  $scope.ordem = 'desc';
  $scope.tipoGrafico = ler('tipoGrafico', 'barra');
  $scope.mostrarAnomalias = ler('anomalias', false);
  $scope.buscaTabela = '';
  $scope.buscaMenu = '';
  $scope.gruposFechados = ler('gruposFechados', {});
  $scope.areasFechadas = ler('areasFechadas', {});
  $scope.colunasOcultas = ler('colunasOcultas', {});
  $scope.metas = ler('metas', {});
  $scope.views = ler('views', []);
  $scope.seriesOcultas = {};
  $scope.escopoMenu = ler('escopoMenu', 'area');
  $scope.atalhosTecla = ler('atalhosTecla', true);

  // Favoritos são um MAPA no escopo (o template testa favoritos[d.id] a
  // cada digest) mas continuam gravados como lista, que é o formato que
  // já está no localStorage de quem usa o painel.
  var ordemFavoritos = ler('favoritos', []);
  $scope.favoritos = {};
  ordemFavoritos.forEach(function (id) { $scope.favoritos[id] = true; });
  var recentes = ler('recentes', []);

  $scope.usuario = null;
  $scope.perfil = null;
  $scope.catalogo = null;
  $scope.grupos = [];
  $scope.dimensao = null;
  $scope.indicador = null;
  $scope.resultado = null;
  $scope.blocos = [];
  $scope.evolucao = null;
  $scope.drill = null;
  $scope.dicionario = {};
  $scope.doCache = null;
  $scope.avisoIndicadorTrocado = '';

  // Área ativa (aba). 'geral' é a Visão Geral: resumo, o que mudou,
  // pontos de entrada e evolução. As demais mostram KPIs e cortes do
  // assunto.
  $scope.area = ler('area', 'geral');
  $scope.areaAtual = null;

  // Estruturas de navegação. Todas são pré-computadas em $watch e nunca
  // recriadas por função de template: array novo a cada digest dentro de
  // ng-repeat é o caminho curto para $rootScope:infdig.
  $scope.indiceAreas = {};      // { areaId: {qtd, grupos, sugeridas} }
  $scope.menuSecoes = [];       // seções do menu lateral
  $scope.favoritosDim = [];
  $scope.recentesDim = [];
  $scope.areasNavegacao = [];   // grade "Por onde começar"
  $scope.cortesDaArea = [];     // grade "Ver por…" da área ativa
  $scope.topVariacoes = [];     // faixa "O que mudou"
  $scope.cortesNoMenu = 0;
  $scope.totalBlocos = 0;

  // Paleta de comandos: busca sobre o índice indicador × corte.
  $scope.palheta = { aberta: false, termo: '', resultados: [], sel: 0, total: 0, idSel: '' };
  $scope.sugestoesPalheta = [];

  // Tendência mensal do corte inteiro: uma consulta agrupada por mês,
  // sempre sob demanda (ver carregarTendencia).
  $scope.tend = { aberta: false, ano: String(anoAtual), dados: null, erro: '', yoy: false };

  $scope.carregando = { blocos: 0, evolucao: false, dados: false, drill: false, tendencia: false };
  $scope.erros = { evolucao: '', dados: '', catalogo: '' };
  $scope.painel = {
    periodo: false, colunas: false, metas: false, views: false,
    exportar: false, atalhos: false, mais: false, dicionario: false
  };
  $scope.novaView = '';

  var graficoEvolucao = null, graficoDim = null, graficoDrill = null, graficoTend = null;

  // ══════════════════════════════════════════════════════════
  // Tema
  // ══════════════════════════════════════════════════════════
  function aplicarTema() {
    var escuro = $scope.tema === 'escuro' ||
      ($scope.tema === 'auto' && window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-tema', escuro ? 'escuro' : 'claro');
    // Chart.js pinta no canvas, então precisa ser redesenhado no tema novo.
    $timeout(redesenharGraficos, 30);
  }

  // Todo Chart novo tem de entrar aqui, senão ele não reage a tema nem a
  // redimensionamento — é o tipo de esquecimento que não dá erro.
  function redesenharGraficos() {
    desenharEvolucao();
    desenharDimensao();
    desenharTendencia();
  }
  $scope.alternarTema = function () {
    var ordem = ['auto', 'claro', 'escuro'];
    $scope.tema = ordem[(ordem.indexOf($scope.tema) + 1) % 3];
    gravar('tema', $scope.tema);
    aplicarTema();
    toast('Tema: ' + { auto: 'automático', claro: 'claro', escuro: 'escuro' }[$scope.tema]);
  };
  aplicarTema();

  $scope.alternarCompacta = function () {
    $scope.compacta = !$scope.compacta;
    gravar('compacta', $scope.compacta);
  };
  $scope.alternarMenu = function () {
    $scope.menuAberto = !$scope.menuAberto;
    gravar('menuAberto', $scope.menuAberto);
    $timeout(redesenharGraficos, 220);
  };
  $scope.alternarAtalhosTecla = function () {
    $scope.atalhosTecla = !$scope.atalhosTecla;
    gravar('atalhosTecla', $scope.atalhosTecla);
  };

  // ══════════════════════════════════════════════════════════
  // Período
  // ══════════════════════════════════════════════════════════
  function dataDeHoje(deslocDias) {
    var d = new Date();
    if (deslocDias) d.setDate(d.getDate() + deslocDias);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  var hojeStr = dataDeHoje(0), ontemStr = dataDeHoje(-1);
  $scope.hojeInput = hojeStr;

  // input[type=date] do Angular espera um objeto Date no ngModel — se
  // ligarmos direto a string "AAAA-MM-DD" que usamos no resto do código
  // (URL, presets, requisição), o calendário nativo renderiza vazio.
  // Mantemos $scope.dia como a string canônica e espelhamos num Date só
  // para o input.
  function paraDataLocal(str) {
    var p = str.split('-');
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  }
  function paraStrData(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Os campos de ano/mês/dia do popup vivem dentro de ng-if + ng-switch, e
  // cada uma dessas diretivas cria um escopo filho. Ligar ng-model direto a
  // um primitivo do controller ($scope.ano) faria a escrita cair no escopo
  // filho (shadowing) e o valor nunca chegaria aqui — era o motivo de
  // escolher ano/mês/dia específico não filtrar nada, enquanto os atalhos
  // (que escrevem direto no controller) funcionavam. Os inputs ligam em
  // propriedades deste objeto: a referência é a mesma no escopo filho.
  $scope.sel = { ano: $scope.ano, mes: $scope.mes, diaData: null };
  $scope.$watchGroup(['ano', 'mes', 'dia'], function () {
    $scope.sel.ano = $scope.ano;
    $scope.sel.mes = $scope.mes;
    $scope.sel.diaData = $scope.dia ? paraDataLocal($scope.dia) : null;
  });

  function periodo() {
    if ($scope.dia) return { tipoPeriodo: 'dia', periodoValor: $scope.dia };
    return $scope.mes
      ? { tipoPeriodo: 'mes', periodoValor: $scope.ano + '-' + $scope.mes + '-01' }
      : { tipoPeriodo: 'ano', periodoValor: $scope.ano };
  }

  // Rótulo único do período ativo — mostrado no botão que abre o painel,
  // pra não precisar de vários campos soltos na barra de topo.
  $scope.rotuloPeriodoAtual = function () {
    if ($scope.dia) {
      if ($scope.dia === hojeStr) return 'Hoje';
      if ($scope.dia === ontemStr) return 'Ontem';
      var p = $scope.dia.split('-');
      return p[2] + '/' + p[1] + '/' + p[0];
    }
    if ($scope.mes) return NOMES_MESES[parseInt($scope.mes, 10) - 1] + '/' + $scope.ano;
    return 'Ano ' + $scope.ano;
  };

  $scope.abrirPainelPeriodo = function (ev) {
    $scope.abaPeriodo = $scope.dia ? 'dia' : ($scope.mes ? 'mes' : 'ano');
    $scope.abrirPainel('periodo', ev);
  };

  $scope.mudarAbaPeriodo = function (aba) {
    $scope.abaPeriodo = aba;
    if (aba === 'dia') { if (!$scope.dia) $scope.dia = hojeStr; }
    else { $scope.dia = ''; if (aba === 'mes' && !$scope.mes) $scope.mes = mesAtual; if (aba === 'ano') $scope.mes = ''; }
    $scope.aplicarPeriodo();
  };

  // Ano/mês e dia são mutuamente exclusivos: escolher um valor limpa o outro.
  $scope.mudarAnoMesValor = function () {
    $scope.ano = $scope.sel.ano;
    $scope.mes = $scope.abaPeriodo === 'ano' ? '' : ($scope.sel.mes || '');
    $scope.dia = '';
    $scope.aplicarPeriodo();
  };
  $scope.mudarDiaValor = function () {
    // Enquanto o usuário digita o segmento de ano no input[type=date] nativo,
    // o navegador emite valores intermediários com ano de 1-3 dígitos (ex.:
    // "2", "20", "202" antes de "2026"). Esses valores viram um Date válido
    // (ano < 100 vai para 19xx pela regra legada do construtor Date), e sem
    // essa guarda o watch de período propagava isso e disparava requisições
    // com ano errado (ex.: 1906) a cada tecla, atrapalhando a digitação.
    if ($scope.sel.diaData && $scope.sel.diaData.getFullYear() < 1000) return;
    $scope.dia = $scope.sel.diaData ? paraStrData($scope.sel.diaData) : '';
    $scope.aplicarPeriodo();
  };

  $scope.presets = [
    { id: 'ano', nome: 'Ano atual' },
    { id: 'ano_ant', nome: 'Ano anterior' },
    { id: 'mes', nome: 'Mês atual' },
    { id: 'mes_ant', nome: 'Mês anterior' },
    { id: 'hoje', nome: 'Hoje' },
    { id: 'ontem', nome: 'Ontem' }
  ];

  $scope.presetAtivo = function (id) {
    if (id === 'hoje') return $scope.dia === hojeStr;
    if (id === 'ontem') return $scope.dia === ontemStr;
    if ($scope.dia) return false;
    if (id === 'ano') return $scope.ano === String(anoAtual) && !$scope.mes;
    if (id === 'ano_ant') return $scope.ano === String(anoAtual - 1) && !$scope.mes;
    if (id === 'mes') return $scope.ano === String(anoAtual) && $scope.mes === mesAtual;
    if (id === 'mes_ant') {
      var m = parseInt(mesAtual, 10) - 1;
      var ano = m === 0 ? anoAtual - 1 : anoAtual;
      var mes = m === 0 ? '12' : String(m).padStart(2, '0');
      return $scope.ano === String(ano) && $scope.mes === mes;
    }
    return false;
  };

  $scope.aplicarPreset = function (id) {
    $scope.dia = '';
    if (id === 'ano') { $scope.ano = String(anoAtual); $scope.mes = ''; $scope.abaPeriodo = 'ano'; }
    if (id === 'ano_ant') { $scope.ano = String(anoAtual - 1); $scope.mes = ''; $scope.abaPeriodo = 'ano'; }
    if (id === 'mes') { $scope.ano = String(anoAtual); $scope.mes = mesAtual; $scope.abaPeriodo = 'mes'; }
    if (id === 'mes_ant') {
      var m = parseInt(mesAtual, 10) - 1;
      $scope.ano = String(m === 0 ? anoAtual - 1 : anoAtual);
      $scope.mes = m === 0 ? '12' : String(m).padStart(2, '0');
      $scope.abaPeriodo = 'mes';
    }
    if (id === 'hoje') { $scope.dia = hojeStr; $scope.abaPeriodo = 'dia'; }
    if (id === 'ontem') { $scope.dia = ontemStr; $scope.abaPeriodo = 'dia'; }
    $scope.aplicarPeriodo();
  };

  $scope.aplicarPeriodo = function () {
    salvarEstadoNaUrl();
    carregarBlocos();
    carregarEvolucao();
    carregarDados();
  };

  $scope.alternarComparar = function () {
    $scope.comparar = !$scope.comparar;
    gravar('comparar', $scope.comparar);
    carregarBlocos();
    carregarDados();
  };

  // ══════════════════════════════════════════════════════════
  // Guarda de acesso
  // ══════════════════════════════════════════════════════════
  (function guardaLocal() {
    if (!localStorage.getItem('tasy_token')) { window.location.replace('login.html'); return; }
    var p = null;
    try { p = JSON.parse(localStorage.getItem('tasy_perfil') || 'null'); } catch (e) { p = null; }
    if (!p || !p.dashboards || p.dashboards.indexOf('geral') === -1) window.location.replace('hub.html');
  }());

  $http.get('/api/auth/me', { headers: headers() }).then(function (resp) {
    $scope.usuario = resp.data.usuario;
    $scope.perfil = resp.data.perfil;
    // Cache de outro usuário nunca pode ser mostrado para este.
    var anterior = ler('cacheUsuario', null);
    if (anterior && anterior !== resp.data.usuario.nm_usuario) { purgarCache(); $scope.doCache = null; }
    gravar('cacheUsuario', resp.data.usuario.nm_usuario);
    localStorage.setItem('tasy_perfil', JSON.stringify(resp.data.perfil));
    localStorage.setItem('tasy_usuario', JSON.stringify(resp.data.usuario));
    if (!resp.data.perfil.direcao) { window.location.replace('hub.html'); return; }
    carregarCatalogo();
  }, function (resp) {
    if (resp && (resp.status === 401 || resp.status === 403)) { sair(); return; }
    $scope.erros.catalogo = erroDe(resp);
  });

  // ══════════════════════════════════════════════════════════
  // Catálogo e navegação
  // ══════════════════════════════════════════════════════════
  var dimensoesPorId = {};
  var areasPorId = {};

  // Indexa o catálogo. Roda tanto para a resposta do servidor quanto
  // para a versão vinda do cache, então não pode ter efeito de rede.
  function aplicarCatalogo(cat) {
    $scope.catalogo = cat;
    $scope.grupos = cat.grupos;
    $scope.dicionario = cat.indicadores || {};
    areasPorId = {};
    dimensoesPorId = {};
    (cat.areas || []).forEach(function (a) { areasPorId[a.id] = a; });
    cat.grupos.forEach(function (g) {
      g._qtdPesados = 0;
      g._qtdCompostas = 0;
      g.dimensoes.forEach(function (d) {
        d.corGrupo = g.cor;
        d.iconeGrupo = g.icone;
        dimensoesPorId[d.id] = d;
        if (d.pesado) g._qtdPesados++;
        if (d.composta) g._qtdCompostas++;
      });
    });
    montarIndiceBusca(cat.grupos);
    recalcularIndiceAreas();
  }

  function carregarCatalogo() {
    $scope.erros.catalogo = '';
    $http.get(API + '/catalogo', { headers: headers() }).then(function (resp) {
      gravarCache('cat', VERSAO_CACHE, resp.data);
      var jaTinha = !!$scope.dimensao;
      aplicarCatalogo(resp.data);

      // Vindo do cache, o corte e o período já estão na tela: revalidar
      // é só refazer as consultas, sem repetir a escolha inicial.
      if (jaTinha) {
        recalcularArea();
        recalcularMenu();
        carregarBlocos();
        carregarEvolucao();
        carregarDados();
        return;
      }

      var estado = lerEstadoDaUrl();
      var inicial = (estado.dim && dimensoesPorId[estado.dim]) ||
        dimensoesPorId[ler('ultimaDimensao', '')] ||
        resp.data.grupos[0].dimensoes[0];
      if (estado.ano) $scope.ano = estado.ano;
      if (estado.mes != null) $scope.mes = estado.mes;
      if (estado.dia) $scope.dia = estado.dia;

      // A área da URL manda; senão a última salva; senão a do corte inicial.
      if (estado.area && areasPorId[estado.area]) $scope.area = estado.area;
      else if (!areasPorId[$scope.area]) $scope.area = 'geral';
      recalcularArea();

      carregarBlocos();
      carregarEvolucao();
      $scope.selecionarDimensao(inicial, estado.ind, true);
    }, function (resp) { $scope.erros.catalogo = erroDe(resp); });
  }
  $scope.carregarCatalogo = carregarCatalogo;

  // ── Índice de áreas ────────────────────────────────────────
  // Contadores e sugestões pré-calculados. Antes o contador da aba era
  // uma função somando 26 grupos × 7 abas a cada digest.
  var gruposDaAreaCache = [];
  var MAX_SUGERIDAS = 6;

  function recalcularIndiceAreas() {
    var idx = {};
    ($scope.grupos || []).forEach(function (g) {
      var a = idx[g.area] || (idx[g.area] = { qtd: 0, grupos: [], sugeridas: [] });
      a.qtd += g.dimensoes.length;
      a.grupos.push(g);
    });
    // Sugestão = primeiro corte não-pesado de cada grupo. A ordem em
    // dimensoes.js já é editorial, então isso dá cobertura em largura
    // (um corte por assunto) sem inventar ranking nem tocar no backend.
    Object.keys(idx).forEach(function (id) {
      var a = idx[id];
      a.grupos.forEach(function (g) {
        if (a.sugeridas.length >= MAX_SUGERIDAS) return;
        var leve = null;
        for (var i = 0; i < g.dimensoes.length; i++) {
          if (!g.dimensoes[i].pesado) { leve = g.dimensoes[i]; break; }
        }
        a.sugeridas.push(leve || g.dimensoes[0]);
      });
    });
    $scope.indiceAreas = idx;

    $scope.areasNavegacao = ($scope.catalogo && $scope.catalogo.areas || [])
      .filter(function (a) { return a.id !== 'geral' && idx[a.id] && idx[a.id].qtd; })
      .map(function (a) {
        return {
          id: a.id, nome: a.nome, icone: a.icone, cor: a.cor, descricao: a.descricao,
          qtd: idx[a.id].qtd, sugeridas: idx[a.id].sugeridas
        };
      });
  }

  function recalcularArea() {
    $scope.areaAtual = areasPorId[$scope.area] || null;
    gruposDaAreaCache = (($scope.indiceAreas[$scope.area] || {}).grupos) || [];
    $scope.cortesDaArea = $scope.area === 'geral' ? [] : gruposDaAreaCache;
  }

  $scope.selecionarArea = function (id) {
    if ($scope.area === id) return;
    $scope.area = id;
    gravar('area', id);
    $scope.buscaMenu = '';
    recalcularArea();
    recalcularMenu();
    carregarBlocos();
    if (id === 'geral' && (evolucaoPendente || !$scope.evolucao)) carregarEvolucao();
    else if (id === 'geral') $timeout(desenharEvolucao);
    // Trocar de aba sem trocar o corte deixaria o explorador mostrando
    // dado de outra área — reposiciona no primeiro corte da nova.
    if (id !== 'geral' && (!$scope.dimensao || $scope.dimensao.area !== id) && gruposDaAreaCache.length) {
      $scope.selecionarDimensao(gruposDaAreaCache[0].dimensoes[0]);
    }
    salvarEstadoNaUrl();
  };

  // ── Menu lateral ───────────────────────────────────────────
  // Recalculado só quando a busca, a área, o escopo ou o catálogo mudam:
  // se fosse função chamada direto no ng-repeat, o filtro criaria objetos
  // novos a cada digest e o Angular entraria em loop ($rootScope:infdig).
  //
  // Três formatos de seção convivem em menuSecoes:
  //   fixa  → Favoritos e Recentes (topo, sempre que houver)
  //   area  → nível extra usado na Visão Geral e na busca em todas as
  //           áreas. Sem ele a aba mais simples do painel despejava os
  //           157 cortes das 7 áreas numa lista só.
  //   grupo → lista rasa, o comportamento de sempre dentro de uma área.
  function filtrarGrupos(grupos, termo) {
    if (!termo) return grupos;
    return grupos.map(function (g) {
      var dims = g.dimensoes.filter(function (d) {
        return normalizar(g.nome + ' ' + d.nome).indexOf(termo) !== -1;
      });
      return dims.length ? angular.extend({}, g, { dimensoes: dims }) : null;
    }).filter(Boolean);
  }

  function recalcularMenu() {
    var termo = normalizar(($scope.buscaMenu || '').trim());
    var secoes = [];
    var total = 0;

    if (!termo) {
      if ($scope.favoritosDim.length) {
        secoes.push({
          tipo: 'fixa', chave: 'fav', nome: '★ Favoritos', icone: '★',
          cor: '#b7791f', dimensoes: $scope.favoritosDim
        });
      }
      if ($scope.recentesDim.length) {
        secoes.push({
          tipo: 'fixa', chave: 'rec', nome: '↻ Recentes', icone: '↻',
          cor: '#64748b', dimensoes: $scope.recentesDim
        });
      }
    }

    // Escopo: só a área ativa, ou todas. Na Visão Geral não existe "só a
    // área" (ela não tem cortes próprios), então cai sempre em todas.
    var porArea = $scope.escopoMenu === 'todas' || $scope.area === 'geral';

    if (porArea) {
      ($scope.catalogo && $scope.catalogo.areas || []).forEach(function (a) {
        var idx = $scope.indiceAreas[a.id];
        if (!idx || !idx.qtd) return;
        var grupos = filtrarGrupos(idx.grupos, termo);
        if (!grupos.length) return;
        var qtd = grupos.reduce(function (s, g) { return s + g.dimensoes.length; }, 0);
        total += qtd;
        secoes.push({
          tipo: 'area', chave: 'a:' + a.id, id: a.id, nome: a.nome,
          icone: a.icone, cor: a.cor, qtd: qtd, grupos: grupos
        });
      });
    } else {
      filtrarGrupos(gruposDaAreaCache, termo).forEach(function (g) {
        total += g.dimensoes.length;
        secoes.push(angular.extend({ tipo: 'grupo', chave: 'g:' + g.nome }, g));
      });
    }

    $scope.menuSecoes = secoes;
    $scope.cortesNoMenu = total;
  }

  $scope.alternarEscopoMenu = function (modo) {
    if ($scope.escopoMenu === modo) return;
    $scope.escopoMenu = modo;
    gravar('escopoMenu', modo);
    recalcularMenu();
  };
  $scope.limparBuscaMenu = function () { $scope.buscaMenu = ''; };

  $scope.areaFechada = function (id) {
    if (($scope.buscaMenu || '').trim()) return false;
    return !!$scope.areasFechadas[id];
  };
  $scope.alternarAreaMenu = function (id) {
    $scope.areasFechadas[id] = !$scope.areasFechadas[id];
    gravar('areasFechadas', $scope.areasFechadas);
  };
  $scope.recolherTudo = function () {
    $scope.menuSecoes.forEach(function (s) {
      if (s.tipo === 'area') $scope.areasFechadas[s.id] = true;
      else $scope.gruposFechados[s.nome] = true;
      (s.grupos || []).forEach(function (g) { $scope.gruposFechados[g.nome] = true; });
    });
    gravar('areasFechadas', $scope.areasFechadas);
    gravar('gruposFechados', $scope.gruposFechados);
  };
  $scope.expandirTudo = function () {
    $scope.areasFechadas = {};
    $scope.gruposFechados = {};
    gravar('areasFechadas', {});
    gravar('gruposFechados', {});
  };

  // ↑/↓/Enter direto do campo de busca: quem digitou já está com a mão
  // no teclado e não deveria precisar do mouse para abrir o resultado.
  $scope.aoTeclarNoMenu = function (ev) {
    if (ev.key !== 'ArrowDown' && ev.key !== 'Enter') return;
    var primeiro = document.querySelector('.menu-lista .g-item');
    if (!primeiro) return;
    ev.preventDefault();
    if (ev.key === 'Enter') primeiro.click(); else primeiro.focus();
  };

  $scope.$watch('buscaMenu', recalcularMenu);
  $scope.$watch('grupos', function () { recalcularArea(); recalcularFavoritos(); recalcularRecentes(); recalcularMenu(); });

  // ══════════════════════════════════════════════════════════
  // Paleta de comandos (Ctrl+K)
  // ══════════════════════════════════════════════════════════
  // A busca do menu casa pelo nome do CORTE. Esta casa pelo nome do
  // INDICADOR também, que é como a direção pensa ("quanto de glosa por
  // convênio"), e cada termo digitado tem de aparecer em algum campo —
  // assim "glosa convenio" acha sem depender da ordem das palavras.
  var LIMITE_PALHETA = 40;
  var indiceBusca = [];

  // Um item por par indicador × corte (~1.160 no total). Montado aqui e
  // não no servidor porque `grupos` já traz tudo o que ele precisa — mandar
  // o índice pronto dobrava o tamanho do catálogo sem acrescentar nada.
  // A chave `_busca` é pré-normalizada: sem isso cada tecla digitada
  // reprocessaria mil strings.
  function montarIndiceBusca(grupos) {
    indiceBusca = [];
    (grupos || []).forEach(function (g) {
      var nomeArea = (areasPorId[g.area] || {}).nome || g.area;
      g.dimensoes.forEach(function (d) {
        d.indicadores.forEach(function (i) {
          indiceBusca.push({
            id: d.id + '|' + i.chave,
            dim: d.id, ind: i.chave, nomeInd: i.nome, nomeDim: d.nome,
            grupo: g.nome, area: g.area, nomeArea: nomeArea,
            cor: i.cor, pesado: d.pesado,
            _busca: normalizar(i.nome + ' ' + d.nome + ' ' + g.nome + ' ' + nomeArea)
          });
        });
      });
    });
    recalcularSugestoes();
  }

  // Estado vazio da paleta: em vez de pedir que a pessoa adivinhe o que
  // digitar, mostra 5 pares clicáveis — os recentes se houver, senão um
  // por área, para ela ver de cara o que a busca sabe fazer.
  function recalcularSugestoes() {
    var out = [];
    var vistos = {};
    recentes.forEach(function (id) {
      if (out.length >= 5) return;
      var d = dimensoesPorId[id];
      if (!d) return;
      var achado = null;
      for (var i = 0; i < indiceBusca.length; i++) {
        if (indiceBusca[i].dim === id && indiceBusca[i].ind === d.indicadorPadrao) { achado = indiceBusca[i]; break; }
      }
      if (achado) { out.push(achado); vistos[achado.area] = true; }
    });
    indiceBusca.forEach(function (r) {
      if (out.length >= 5 || vistos[r.area] || r.pesado) return;
      var d = dimensoesPorId[r.dim];
      if (!d || r.ind !== d.indicadorPadrao) return;
      vistos[r.area] = true;
      out.push(r);
    });
    $scope.sugestoesPalheta = out;
  }

  // Guardamos quem abriu a paleta para devolver o foco no fechamento —
  // sem isso ele cai no <body> e a navegação por teclado se perde.
  var focoAntesDaPalheta = null;

  $scope.abrirPalheta = function (semente) {
    focoAntesDaPalheta = document.activeElement;
    $scope.palheta.aberta = true;
    $scope.palheta.sel = 0;
    if (typeof semente === 'string') $scope.palheta.termo = semente;
    buscarNaPalheta();
    $timeout(function () {
      var el = document.getElementById('campoPalheta');
      if (!el) return;
      el.focus();
      if (typeof semente === 'string') {
        // Cursor no fim: a letra digitada na busca do topo é o começo do
        // termo, não algo a ser substituído pela próxima tecla.
        var n = el.value.length;
        el.setSelectionRange(n, n);
      } else {
        el.select();
      }
    });
  };

  $scope.fecharPalheta = function () {
    $scope.palheta.aberta = false;
    var alvo = focoAntesDaPalheta;
    focoAntesDaPalheta = null;
    if (alvo && alvo.focus) $timeout(function () { alvo.focus(); });
  };

  // A barra do topo é um <button>, mas se comporta como campo: digitar
  // nela abre a paleta já com a letra dentro.
  $scope.aoTeclarNaBuscaGlobal = function (ev) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (!ev.key || ev.key.length !== 1) return;
    ev.preventDefault();
    $scope.abrirPalheta(ev.key);
  };

  // Sem acento: quem digita "orgao" ou "obito" no meio da reunião não deve
  // ficar sem resultado. O intervalo é montado com fromCharCode em vez de
  // escrito no literal para o arquivo não depender de acentos combinantes
  // sobreviverem a cópia/encoding.
  var COMBINANTES = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');

  function normalizar(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(COMBINANTES, '');
  }

  function buscarNaPalheta() {
    var termos = normalizar($scope.palheta.termo).split(/\s+/).filter(Boolean);
    if (!termos.length) {
      $scope.palheta.resultados = [];
      $scope.palheta.total = 0;
      $scope.palheta.idSel = '';
      return;
    }
    var achados = indiceBusca.filter(function (i) {
      return termos.every(function (t) { return i._busca.indexOf(t) !== -1; });
    });
    // Indicador padrão do corte primeiro, e corte leve antes do pesado:
    // é a ordem que dá o resultado mais provável no topo.
    achados.sort(function (a, b) {
      if (!!a.pesado !== !!b.pesado) return a.pesado ? 1 : -1;
      return a.nomeInd.length - b.nomeInd.length;
    });
    $scope.palheta.total = achados.length;
    $scope.palheta.resultados = achados.slice(0, LIMITE_PALHETA);
    if ($scope.palheta.sel >= $scope.palheta.resultados.length) $scope.palheta.sel = 0;
    marcarSelPalheta();
  }
  $scope.buscarNaPalheta = buscarNaPalheta;

  // O foco fica no input (padrão combobox); quem "anda" é o
  // aria-activedescendant, então ele precisa acompanhar a seleção.
  function marcarSelPalheta() {
    $scope.palheta.idSel = $scope.palheta.resultados.length ? 'pal-item-' + $scope.palheta.sel : '';
  }

  $scope.abrirDaPalheta = function (r) {
    var dim = dimensoesPorId[r.dim];
    if (!dim) return;
    $scope.fecharPalheta();
    $scope.selecionarDimensao(dim, r.ind);
  };

  function moverPalheta(passo) {
    var n = $scope.palheta.resultados.length;
    if (!n) return;
    $scope.palheta.sel = (($scope.palheta.sel + passo) % n + n) % n;
    marcarSelPalheta();
    $timeout(function () {
      var el = document.querySelector('.palheta .pal-item.sel');
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    });
  }

  $scope.grupoFechado = function (g) {
    if (($scope.buscaMenu || '').trim()) return false;
    return !!$scope.gruposFechados[g.nome];
  };
  $scope.alternarGrupo = function (g) {
    $scope.gruposFechados[g.nome] = !$scope.gruposFechados[g.nome];
    gravar('gruposFechados', $scope.gruposFechados);
  };

  // ── Favoritos e recentes ───────────────────────────────────
  // Listas materializadas em campo de escopo. Antes dimensoesFavoritas()
  // era chamada em 5 pontos do template e recriava o array em cada um.
  function recalcularFavoritos() {
    $scope.favoritosDim = ordemFavoritos
      .map(function (id) { return dimensoesPorId[id]; })
      .filter(Boolean);
  }
  function recalcularRecentes() {
    $scope.recentesDim = recentes
      .map(function (id) { return dimensoesPorId[id]; })
      .filter(Boolean);
  }

  $scope.alternarFavorito = function (d, ev) {
    if (ev) ev.stopPropagation();
    var i = ordemFavoritos.indexOf(d.id);
    if (i === -1) { ordemFavoritos.push(d.id); $scope.favoritos[d.id] = true; }
    else { ordemFavoritos.splice(i, 1); delete $scope.favoritos[d.id]; }
    gravar('favoritos', ordemFavoritos);
    recalcularFavoritos();
    recalcularMenu();
  };
  $scope.aoTeclarFavorito = function (ev, d) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    ev.preventDefault();
    $scope.alternarFavorito(d, ev);
  };

  // 8 cortes, sem repetição, mais recente primeiro. É o que dá um ponto
  // de entrada a quem ainda não favoritou nada.
  var MAX_RECENTES = 8;
  function registrarRecente(id) {
    var i = recentes.indexOf(id);
    if (i !== -1) recentes.splice(i, 1);
    recentes.unshift(id);
    if (recentes.length > MAX_RECENTES) recentes.length = MAX_RECENTES;
    gravar('recentes', recentes);
    recalcularRecentes();
    recalcularSugestoes();
  }

  // Escolher um corte pode trocar a aba: a paleta e a busca do menu
  // atravessam áreas, e a tela tem de acompanhar para não mostrar os KPIs
  // de uma área com o explorador de outra. `manterArea` é usado só na
  // carga inicial, onde a aba já veio da URL ou do localStorage.
  $scope.selecionarDimensao = function (dim, indicador, manterArea) {
    if (!dim) return;
    $scope.dimensao = dim;
    $scope.indicador = indicador && indicadorValido(dim, indicador) ? indicador : dim.indicadorPadrao;
    $scope.buscaTabela = '';
    $scope.avisoIndicadorTrocado = '';
    fecharTendencia();
    gravar('ultimaDimensao', dim.id);
    registrarRecente(dim.id);

    if (!manterArea && dim.area && dim.area !== $scope.area && areasPorId[dim.area]) {
      $scope.area = dim.area;
      gravar('area', dim.area);
      recalcularArea();
      recalcularMenu();
      carregarBlocos();
    }
    carregarDados();
  };

  function indicadorValido(dim, chave) {
    return dim.indicadores.some(function (i) { return i.chave === chave; });
  }

  $scope.selecionarIndicador = function (chave) {
    $scope.indicador = chave;
    carregarDados();
  };

  $scope.inverterOrdem = function () {
    $scope.ordem = $scope.ordem === 'desc' ? 'asc' : 'desc';
    carregarDados();
  };

  $scope.ordenarPor = function (chave) {
    if ($scope.indicador === chave) $scope.inverterOrdem();
    else $scope.selecionarIndicador(chave);
  };
  // <th> com ng-click não é focável: sem isto, ordenar a tabela é
  // impossível sem mouse.
  $scope.ordenarPorTecla = function (ev, chave) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    ev.preventDefault();
    ev.stopPropagation();
    $scope.ordenarPor(chave);
  };
  $scope.ariaSortDe = function (chave) {
    if ($scope.indicador !== chave) return 'none';
    return $scope.ordem === 'desc' ? 'descending' : 'ascending';
  };

  $scope.aplicarLimite = function () {
    gravar('limite', $scope.limite);
    carregarDados();
  };

  $scope.alterarTipoGrafico = function (tipo) {
    $scope.tipoGrafico = tipo;
    gravar('tipoGrafico', tipo);
    $timeout(desenharDimensao);
  };

  // ══════════════════════════════════════════════════════════
  // Resumo executivo (um pedido por bloco, em paralelo)
  // ══════════════════════════════════════════════════════════
  // Blocos da aba ativa. Na Visão Geral entram só os marcados `resumo`
  // pelo servidor — os 28 cartões juntos seriam ~110 KPIs numa tela.
  function blocosDaArea() {
    if (!$scope.catalogo) return [];
    return $scope.catalogo.blocos.filter(function (b) {
      return $scope.area === 'geral' ? b.resumo : b.area === $scope.area;
    });
  }
  $scope.blocosDaArea = blocosDaArea;

  function carregarBlocos(incluirPesados) {
    if (!$scope.catalogo) return;
    var daArea = blocosDaArea();
    var alvos = daArea.filter(function (b) {
      return incluirPesados ? true : !b.pesado;
    });

    // Placeholders na ordem do catálogo: os cartões já aparecem
    // esqueleto e vão sendo preenchidos conforme cada bloco responde.
    var existentes = {};
    ($scope.blocos || []).forEach(function (b) { if (b.kpis) existentes[b.chave] = b; });

    // Refaz sempre os blocos leves da aba (o servidor cacheia 15 min, então
    // voltar para uma aba já vista não custa nova varredura) e guarda o
    // conteúdo dos pesados que a pessoa já mandou carregar.
    var sigP = assinaturaPeriodo();
    $scope.blocos = daArea.map(function (b) {
      if (alvos.indexOf(b) === -1) {
        return existentes[b.chave] ||
          { chave: b.chave, titulo: b.titulo, icone: b.icone, pesado: b.pesado, cor: corDoBloco(b.chave), adiado: true };
      }
      // Cache: o cartão já nasce com os números da última consulta em vez
      // de esqueleto, e é sobrescrito quando a resposta real chega.
      var salvo = lerCache('bloco_' + b.chave, sigP);
      if (salvo) {
        marcarCache(salvo.quando);
        return angular.extend({}, salvo.res, { cor: corDoBloco(b.chave), carregando: true });
      }
      return { chave: b.chave, titulo: b.titulo, icone: b.icone, pesado: b.pesado, cor: corDoBloco(b.chave), carregando: true };
    });

    $scope.carregando.blocos = alvos.length;
    $scope.totalBlocos = alvos.length;

    alvos.forEach(function (b) {
      var corpo = angular.extend({ bloco: b.chave, comparar: $scope.comparar }, periodo());
      $http.post(API + '/resumo', corpo, { headers: headers(), timeout: 180000 })
        .then(function (resp) {
          gravarCache('bloco_' + b.chave, sigP, resp.data.blocos[0]);
          substituirBloco(b.chave, resp.data.blocos[0]);
        }, function (resp) {
          substituirBloco(b.chave, { chave: b.chave, titulo: b.titulo, icone: b.icone, erro: erroDe(resp) });
        })
        .finally(function () {
          $scope.carregando.blocos--;
          if ($scope.carregando.blocos <= 0) limparCacheSeTudoCarregado();
        });
    });
  }
  $scope.carregarBlocos = carregarBlocos;

  function substituirBloco(chave, novo) {
    for (var i = 0; i < $scope.blocos.length; i++) {
      if ($scope.blocos[i].chave === chave) {
        novo.cor = corDoBloco(chave);
        $scope.blocos[i] = novo;
        recalcularTopVariacoes();
        return;
      }
    }
  }

  // "O que mudou": as 4 maiores variações entre TODOS os blocos já
  // carregados. Numa abertura com ~40 números do mesmo peso, é o que
  // diz por onde começar a olhar. Mutado in-place — nunca uma função
  // chamada do ng-repeat.
  function recalcularTopVariacoes() {
    var todos = [];
    ($scope.blocos || []).forEach(function (b) {
      (b.kpis || []).forEach(function (k) {
        if (k.variacao == null || !isFinite(k.variacao) || Math.abs(k.variacao) < 5) return;
        todos.push({
          chave: b.chave + '.' + k.chave, nome: k.nome, bloco: b.titulo,
          variacao: k.variacao, melhor: k.melhor,
          valorFormatado: k.valorFormatado, valorAnteriorFormatado: k.valorAnteriorFormatado
        });
      });
    });
    todos.sort(function (x, y) { return Math.abs(y.variacao) - Math.abs(x.variacao); });
    $scope.topVariacoes.length = 0;
    todos.slice(0, 4).forEach(function (t) { $scope.topVariacoes.push(t); });
  }

  // Uma cor por bloco, alinhada à cor do grupo equivalente no menu — é o
  // que faz o cartão e o corte parecerem a mesma coisa.
  var CORES_BLOCO = {
    financeiro: '#2a78d6', retorno: '#0284c7', recebimento: '#1baf7a', contas: '#0284c7',
    guias: '#4a3aa7', protocolos: '#d97706', contabil: '#6b7488',
    atendimento: '#4a3aa7', ocupacao: '#0d9488', producao: '#eb6834', cirurgico: '#b3275f',
    fisioterapia: '#8b5cf6', diagnosticos: '#0284c7',
    sus_aih: '#1baf7a', sus_apac: '#0d9488', sus_laudos: '#4a3aa7', repasse: '#eda100',
    compras: '#6b7488', nutricao: '#0d9488', custo: '#991b1b', farmacia: '#eda100',
    exames: '#2a78d6', prescricao: '#8b5cf6',
    manutencao: '#d97706',
    res_caixa: '#eb6834', res_prod_conta: '#0284c7', res_margem: '#1baf7a', res_custo_int: '#991b1b'
  };
  function corDoBloco(chave) { return CORES_BLOCO[chave] || '#0d9488'; }

  $scope.carregarBloco = function (bloco) {
    bloco.carregando = true;
    bloco.adiado = false;
    var corpo = angular.extend({ bloco: bloco.chave, comparar: $scope.comparar }, periodo());
    $http.post(API + '/resumo', corpo, { headers: headers(), timeout: 300000 })
      .then(function (resp) { substituirBloco(bloco.chave, resp.data.blocos[0]); },
        function (resp) { substituirBloco(bloco.chave, angular.extend({}, bloco, { carregando: false, erro: erroDe(resp) })); });
  };

  // Pinta os cartões do cache sem disparar nenhuma requisição — é o que
  // faz a abertura ter números em vez de 8 esqueletos.
  function preencherBlocosDoCache() {
    if (!$scope.catalogo) return;
    var sigP = assinaturaPeriodo();
    var achou = false;
    $scope.blocos = blocosDaArea().map(function (b) {
      var salvo = lerCache('bloco_' + b.chave, sigP);
      if (salvo) {
        achou = true;
        marcarCache(salvo.quando);
        return angular.extend({}, salvo.res, { cor: corDoBloco(b.chave), carregando: true });
      }
      return { chave: b.chave, titulo: b.titulo, icone: b.icone, pesado: b.pesado, cor: corDoBloco(b.chave), carregando: true };
    });
    if (achou) recalcularTopVariacoes();
  }

  $scope.carregarPesados = function () { carregarBlocos(true); };

  $scope.temPesadosAdiados = function () {
    return ($scope.blocos || []).some(function (b) { return b.adiado; });
  };

  // Classe do delta respeitando a direção desejada do indicador:
  // glosa subindo é ruim, faturamento subindo é bom.
  $scope.classeDelta = function (variacao, melhor) {
    if (variacao == null || Math.abs(variacao) < 0.05) return 'delta-neutro';
    if (melhor === 'neutro' || !melhor) return 'delta-neutro';
    var bom = variacao > 0 ? melhor === 'maior' : melhor === 'menor';
    return bom ? 'delta-bom' : 'delta-ruim';
  };
  // Meta no cartão de KPI. $scope.metas é indexada pela mesma chave que
  // k.chave e o backend já manda k.valor cru, então a meta que a direção
  // digitou no explorador vale aqui sem nada a mais.
  // Prioridade meta > delta: marcar os dois no mesmo cartão é ruído.
  $scope.classeMetaKpi = function (k) {
    var meta = $scope.metas[k.chave];
    if (meta == null || meta === '' || isNaN(meta) || k.valor == null) return '';
    if (k.melhor === 'menor') return k.valor <= meta ? 'meta-ok' : 'meta-falha';
    if (k.melhor === 'maior') return k.valor >= meta ? 'meta-ok' : 'meta-falha';
    return '';
  };

  $scope.setaDelta = function (v) { return v == null ? '' : (v > 0 ? '▲' : v < 0 ? '▼' : '='); };
  $scope.fmtDelta = function (v) {
    if (v == null) return 'sem base';
    return (v > 0 ? '+' : '') + v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
  };

  // ══════════════════════════════════════════════════════════
  // Evolução consolidada
  // ══════════════════════════════════════════════════════════
  // A evolução só é desenhada na Visão Geral. Fora dela nem pedimos:
  // são 8 varreduras em paralelo que ninguém veria. Fica pendente e é
  // buscada quando a aba volta a ser aberta.
  var evolucaoPendente = false;

  function carregarEvolucao() {
    if ($scope.area !== 'geral') { evolucaoPendente = true; return; }
    evolucaoPendente = false;
    $scope.carregando.evolucao = true;
    $scope.erros.evolucao = '';

    var sigP = assinaturaPeriodo();
    var salvo = lerCache('evol', sigP);
    if (salvo && !$scope.evolucao) {
      $scope.evolucao = salvo.res;
      marcarCache(salvo.quando);
      $timeout(desenharEvolucao);
    }

    $http.post(API + '/evolucao', periodo(), { headers: headers(), timeout: 240000 }).then(function (resp) {
      gravarCache('evol', sigP, resp.data);
      $scope.evolucao = resp.data;
      $timeout(desenharEvolucao);
    }, function (resp) {
      $scope.erros.evolucao = erroDe(resp);
    }).finally(function () {
      $scope.carregando.evolucao = false;
      limparCacheSeTudoCarregado();
    });
  }
  $scope.carregarEvolucao = carregarEvolucao;

  $scope.alternarSerie = function (chave) {
    $scope.seriesOcultas[chave] = !$scope.seriesOcultas[chave];
    desenharEvolucao();
  };

  // ══════════════════════════════════════════════════════════
  // Dados da dimensão
  // ══════════════════════════════════════════════════════════
  var requisicaoAtual = 0;

  function carregarDados() {
    if (!$scope.dimensao) return;
    var meu = ++requisicaoAtual;
    $scope.carregando.dados = true;
    $scope.erros.dados = '';
    salvarEstadoNaUrl();

    var pedido = $scope.indicador;
    var sig = assinaturaDados();
    var salvo = lerCache('dim', sig);
    if (salvo && !$scope.resultado) {
      $scope.resultado = salvo.res;
      marcarCache(salvo.quando);
      calcularAnomalias();
      $timeout(desenharDimensao);
    }

    var corpo = angular.extend({
      dimensao: $scope.dimensao.id,
      indicador: $scope.indicador,
      ordem: $scope.ordem,
      limite: parseInt($scope.limite, 10),
      comparar: $scope.comparar
    }, periodo());

    $http.post(API, corpo, { headers: headers(), timeout: 300000 }).then(function (resp) {
      if (meu !== requisicaoAtual) return; // resposta velha: descarta
      // Gravar ANTES de encostar no $scope: depois do ng-repeat cada
      // linha ganha $$hashKey e o cache voltaria com lixo.
      gravarCache('dim', sig, podarParaCache(resp.data));
      $scope.resultado = resp.data;
      // Quando o corte novo não tem o indicador pedido, o servidor
      // devolve outro. Isso acontecia em silêncio e parecia bug.
      $scope.avisoIndicadorTrocado = (pedido && resp.data.indicador !== pedido)
        ? 'Este corte não tem o indicador anterior — mostrando “' + resp.data.nomeIndicador + '”.'
        : '';
      $scope.indicador = resp.data.indicador;
      calcularAnomalias();
      $timeout(desenharDimensao);
    }, function (resp) {
      if (meu !== requisicaoAtual) return;
      $scope.resultado = null;
      $scope.erros.dados = erroDe(resp);
    }).finally(function () {
      if (meu !== requisicaoAtual) return;
      $scope.carregando.dados = false;
      limparCacheSeTudoCarregado();
    });
  }
  $scope.recarregar = function () { carregarBlocos(); carregarEvolucao(); carregarDados(); };
  $scope.tentarNovamente = carregarDados;

  // Anomalia = valor a mais de 2 desvios-padrão da média do indicador
  // ativo. Serve para a direção achar o ponto fora da curva sem ler a
  // tabela inteira.
  function calcularAnomalias() {
    var r = $scope.resultado;
    if (!r || !r.dados.length) return;
    var vals = r.dados.map(function (d) { return d.valorRaw; });
    var media = vals.reduce(function (s, v) { return s + v; }, 0) / vals.length;
    var dp = Math.sqrt(vals.reduce(function (s, v) { return s + Math.pow(v - media, 2); }, 0) / vals.length);
    r.dados.forEach(function (d) {
      d.anomala = dp > 0 && Math.abs(d.valorRaw - media) > 2 * dp;
    });
    r.mediaIndicador = media;
  }

  $scope.alternarAnomalias = function () {
    $scope.mostrarAnomalias = !$scope.mostrarAnomalias;
    gravar('anomalias', $scope.mostrarAnomalias);
  };

  // ── Filtro/derivados da tabela ──
  $scope.linhasVisiveis = function () {
    var r = $scope.resultado;
    if (!r) return [];
    var termo = ($scope.buscaTabela || '').trim().toLowerCase();
    var linhas = termo
      ? r.dados.filter(function (d) { return d.label.toLowerCase().indexOf(termo) !== -1; })
      : r.dados;
    if ($scope.mostrarAnomalias) linhas = linhas.filter(function (d) { return d.anomala; });
    return linhas;
  };

  $scope.limparBusca = function () { $scope.buscaTabela = ''; };

  $scope.participacao = function (linha) {
    var r = $scope.resultado;
    if (!r) return 0;
    var total = r.totais[r.indicador];
    if (!total || total <= 0) return 0;
    return Math.min(100, Math.max(0, (linha.valorRaw / total) * 100));
  };

  $scope.colunasVisiveis = function () {
    var r = $scope.resultado;
    if (!r) return [];
    return r.indicadores.filter(function (i) { return !$scope.colunasOcultas[i.chave]; });
  };
  $scope.alternarColuna = function (chave) {
    $scope.colunasOcultas[chave] = !$scope.colunasOcultas[chave];
    gravar('colunasOcultas', $scope.colunasOcultas);
  };
  $scope.mostrarTodasColunas = function () {
    $scope.colunasOcultas = {};
    gravar('colunasOcultas', {});
  };

  $scope.naoAditivo = function (chave) {
    var r = $scope.resultado;
    return !!(r && r.naoAditivos && r.naoAditivos.indexOf(chave) !== -1);
  };

  // ── Metas ──
  $scope.metaDe = function (chave) { return $scope.metas[chave]; };
  $scope.salvarMetas = function () {
    gravar('metas', $scope.metas);
    $scope.painel.metas = false;
    toast('Metas salvas');
  };
  $scope.limparMetas = function () {
    $scope.metas = {};
    gravar('metas', {});
    toast('Metas removidas');
  };
  // Meta é comparada respeitando a direção do indicador: para "menor é
  // melhor" (glosa, custo), atingir significa ficar ABAIXO da meta.
  $scope.classeMeta = function (linha, ind) {
    var meta = $scope.metas[ind.chave];
    if (meta == null || meta === '' || isNaN(meta)) return '';
    var v = linha[ind.chave];
    if (ind.melhor === 'menor') return v <= meta ? 'meta-ok' : 'meta-falha';
    if (ind.melhor === 'maior') return v >= meta ? 'meta-ok' : 'meta-falha';
    return '';
  };

  // ── Destaques (maiores variações) ──
  $scope.destaques = function () {
    var r = $scope.resultado;
    if (!r || !r.comparado) return [];
    return r.dados
      .filter(function (d) { return d.variacao != null && isFinite(d.variacao) && Math.abs(d.variacao) >= 5; })
      .sort(function (x, y) { return Math.abs(y.variacao) - Math.abs(x.variacao); })
      .slice(0, 4);
  };

  // ══════════════════════════════════════════════════════════
  // Drill-down
  // ══════════════════════════════════════════════════════════
  // Token próprio: `if (!$scope.drill) return` não bastava — abrir o item
  // A, fechar e abrir o B fazia a resposta atrasada de A pintar sob o
  // rótulo de B.
  var tokenDrill = 0;
  var focoAntesDoDrill = null;

  $scope.abrirDrill = function (linha, ev) {
    if (ev) ev.stopPropagation();
    if (!$scope.dimensao) return;
    focoAntesDoDrill = ev && ev.currentTarget ? ev.currentTarget : null;
    var meu = ++tokenDrill;
    $scope.drill = { label: linha.label, dados: null, erro: '', stats: null, _linha: linha };
    $scope.carregando.drill = true;

    var corpo = angular.extend({
      dimensao: $scope.dimensao.id,
      indicador: $scope.indicador,
      drill: linha.label
    }, periodo());

    $http.post(API, corpo, { headers: headers(), timeout: 300000 }).then(function (resp) {
      if (meu !== tokenDrill || !$scope.drill) return;
      $scope.drill.dados = resp.data;
      $scope.drill.stats = estatisticasDrill(resp.data, linha);
      $timeout(function () {
        desenharDrill();
        var fechar = document.getElementById('drillFechar');
        if (fechar) fechar.focus();
      });
    }, function (resp) {
      if (meu !== tokenDrill || !$scope.drill) return;
      $scope.drill.erro = erroDe(resp);
    }).finally(function () {
      if (meu === tokenDrill) $scope.carregando.drill = false;
    });
  };

  // Ranking, participação, média, pico e vale saem todos da resposta que
  // o drill já buscava: nenhuma consulta a mais.
  function estatisticasDrill(d, linha) {
    var r = $scope.resultado;
    if (!d || !d.dados || !d.dados.length) return null;
    var chave = d.indicador;
    var comMovimento = d.dados.filter(function (x) { return x[chave]; });
    var vals = comMovimento.map(function (x) { return x[chave] || 0; });
    if (!vals.length) return null;

    var soma = vals.reduce(function (s, v) { return s + v; }, 0);
    var media = soma / vals.length;
    var pico = comMovimento[0], vale = comMovimento[0];
    comMovimento.forEach(function (x) {
      if ((x[chave] || 0) > (pico[chave] || 0)) pico = x;
      if ((x[chave] || 0) < (vale[chave] || 0)) vale = x;
    });

    var primeiro = comMovimento[0][chave] || 0;
    var ultimo = comMovimento[comMovimento.length - 1][chave] || 0;
    var posicao = r ? r.dados.indexOf(linha) + 1 : 0;

    return {
      posicao: posicao || '—',
      total: r ? r.totalBase : '—',
      participacao: r ? $scope.participacao(linha).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—',
      mediaFmt: formatarComoIndicador(media, d.tipo),
      picoMes: mesPorExtenso(pico.label), picoFmt: pico[chave + '_fmt'],
      valeMes: mesPorExtenso(vale.label), valeFmt: vale[chave + '_fmt'],
      meses: comMovimento.length,
      varPeriodo: primeiro ? ((ultimo - primeiro) / Math.abs(primeiro)) * 100 : null
    };
  }

  // Todos os mesLabel das fontes saem como "AAAA-MM", então não é preciso
  // o parser tolerante dos painéis de área.
  function mesPorExtenso(label) {
    var m = /^(\d{4})-(\d{2})$/.exec(String(label || ''));
    if (!m) return label;
    return NOMES_MESES[parseInt(m[2], 10) - 1] + '/' + m[1];
  }

  // A média não vem formatada do servidor (só os valores das linhas vêm),
  // então é o único ponto do painel que formata número no cliente.
  function formatarComoIndicador(v, tipo) {
    if (v == null || !isFinite(v)) return '—';
    if (tipo === 'moeda') return 'R$ ' + abreviar(v);
    if (tipo === 'percentual') return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
    if (tipo === 'dias') return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' d';
    if (tipo === 'horas') return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' h';
    return abreviar(v);
  }

  $scope.fecharDrill = function () {
    tokenDrill++;
    $scope.drill = null;
    destruir(graficoDrill);
    graficoDrill = null;
    var alvo = focoAntesDoDrill;
    focoAntesDoDrill = null;
    if (alvo && alvo.focus) $timeout(function () { alvo.focus(); });
  };

  // ══════════════════════════════════════════════════════════
  // Tendência mensal do corte
  // ══════════════════════════════════════════════════════════
  // UMA consulta agrupada por mês (POST /tendencia), nunca 12. Doze
  // requisições seriam 12 varreduras completas — 6 a 8 minutos numa
  // fonte pesada, e o cache do servidor não ajudaria porque cada corpo
  // é uma chave diferente. Sempre sob demanda: carregar junto com o
  // corte somaria uma varredura a cada clique no menu.
  var tokenTend = 0;

  function fecharTendencia() {
    tokenTend++;
    $scope.tend.aberta = false;
    $scope.tend.dados = null;
    $scope.tend.erro = '';
    destruir(graficoTend);
    graficoTend = null;
  }

  $scope.alternarTendencia = function () {
    if ($scope.tend.aberta) { fecharTendencia(); return; }
    $scope.tend.aberta = true;
    $scope.tend.ano = $scope.ano;
    carregarTendencia(true);
  };

  $scope.alternarYoY = function () {
    $scope.tend.yoy = !$scope.tend.yoy;
    carregarTendencia(true);
  };

  function carregarTendencia(forcar) {
    if (!$scope.tend.aberta || !$scope.dimensao) return;
    if (!forcar && $scope.tend.dados) return;
    var meu = ++tokenTend;
    $scope.carregando.tendencia = true;
    $scope.tend.erro = '';

    var corpo = {
      dimensao: $scope.dimensao.id,
      indicador: $scope.indicador,
      ano: String($scope.tend.ano),
      comparar: !!$scope.tend.yoy
    };

    $http.post(API + '/tendencia', corpo, { headers: headers(), timeout: 300000 }).then(function (resp) {
      if (meu !== tokenTend) return;
      $scope.tend.dados = resp.data;
      $timeout(desenharTendencia);
    }, function (resp) {
      if (meu !== tokenTend) return;
      $scope.tend.dados = null;
      $scope.tend.erro = erroDe(resp);
    }).finally(function () {
      if (meu === tokenTend) $scope.carregando.tendencia = false;
    });
  }
  $scope.carregarTendencia = carregarTendencia;

  // ══════════════════════════════════════════════════════════
  // Views salvas e deep link
  // ══════════════════════════════════════════════════════════
  function estadoAtual() {
    return {
      area: $scope.area,
      dim: $scope.dimensao ? $scope.dimensao.id : null,
      ind: $scope.indicador,
      ano: $scope.ano,
      mes: $scope.mes,
      dia: $scope.dia,
      ordem: $scope.ordem,
      limite: $scope.limite
    };
  }

  function salvarEstadoNaUrl() {
    var e = estadoAtual();
    if (!e.dim) return;
    var hash = 'area=' + e.area + '&dim=' + e.dim + '&ind=' + e.ind +
      '&ano=' + e.ano + '&mes=' + (e.mes || '') + '&dia=' + (e.dia || '');
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', '#' + hash);
    }
  }

  function lerEstadoDaUrl() {
    var out = {};
    (window.location.hash || '').replace(/^#/, '').split('&').forEach(function (par) {
      var p = par.split('=');
      if (p[0]) out[p[0]] = decodeURIComponent(p[1] || '');
    });
    if (out.mes === '') out.mes = '';
    return out;
  }

  $scope.salvarView = function () {
    var nome = ($scope.novaView || '').trim();
    if (!nome) { toast('Dê um nome para a visão', 'erro'); return; }
    $scope.views = $scope.views.filter(function (v) { return v.nome !== nome; });
    $scope.views.push(angular.extend({ nome: nome }, estadoAtual()));
    gravar('views', $scope.views);
    $scope.novaView = '';
    $scope.painel.views = false;
    toast('Visão "' + nome + '" salva');
  };

  $scope.aplicarView = function (v) {
    $scope.ano = v.ano;
    $scope.mes = v.mes || '';
    $scope.dia = v.dia || '';
    $scope.ordem = v.ordem || 'desc';
    $scope.limite = v.limite || 25;
    $scope.painel.views = false;

    // A área vem antes do corte: assim selecionarDimensao não dispara um
    // segundo carregarBlocos por troca de aba. Visão antiga (sem `area`)
    // cai na área do próprio corte.
    var alvo = dimensoesPorId[v.dim];
    var areaAlvo = v.area || (alvo && alvo.area) || 'geral';
    if (areasPorId[areaAlvo] && areaAlvo !== $scope.area) {
      $scope.area = areaAlvo;
      gravar('area', areaAlvo);
      recalcularArea();
      recalcularMenu();
    }
    carregarBlocos();
    carregarEvolucao();
    $scope.selecionarDimensao(alvo, v.ind, true);
    toast('Visão "' + v.nome + '" aplicada');
  };

  $scope.excluirView = function (v, ev) {
    if (ev) ev.stopPropagation();
    $scope.views = $scope.views.filter(function (x) { return x.nome !== v.nome; });
    gravar('views', $scope.views);
  };

  $scope.copiarLink = function () {
    salvarEstadoNaUrl();
    copiarTexto(window.location.href, 'Link da visão copiado');
  };

  function copiarTexto(texto, msgOk) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(
        function () { $scope.$applyAsync(function () { toast(msgOk); }); },
        function () { $scope.$applyAsync(function () { toast('Não foi possível copiar', 'erro'); }); });
      return;
    }
    // Navegador sem Clipboard API (ou página sem HTTPS): textarea temporária.
    var ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast(msgOk); } catch (e) { toast('Não foi possível copiar', 'erro'); }
    document.body.removeChild(ta);
  }

  $scope.copiarTabela = function () {
    var r = $scope.resultado;
    if (!r) return;
    var cols = $scope.colunasVisiveis();
    var linhas = [[r.nomeDimensao].concat(cols.map(function (c) { return c.nome; })).join('\t')];
    $scope.linhasVisiveis().forEach(function (d) {
      linhas.push([d.label].concat(cols.map(function (c) { return d[c.chave + '_fmt']; })).join('\t'));
    });
    copiarTexto(linhas.join('\n'), 'Tabela copiada (cole no Excel)');
  };

  // ══════════════════════════════════════════════════════════
  // Exportação
  // ══════════════════════════════════════════════════════════
  function nomeArquivo(ext) {
    var r = $scope.resultado;
    var sufixo = $scope.dia || ($scope.ano + ($scope.mes ? '-' + $scope.mes : ''));
    return 'painel-geral_' + (r ? r.dimensao : 'dados') + '_' + sufixo + '.' + ext;
  }

  function baixar(conteudo, tipo, nome) {
    var blob = new Blob([conteudo], { type: tipo });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function matrizExport() {
    var r = $scope.resultado;
    var cols = $scope.colunasVisiveis();
    var linhas = [[r.nomeDimensao].concat(cols.map(function (c) { return c.nome; }))];
    if (r.comparado) linhas[0] = linhas[0].concat(cols.map(function (c) { return c.nome + ' (' + r.periodo.rotuloAnterior + ')'; }));
    $scope.linhasVisiveis().forEach(function (d) {
      var linha = [d.label].concat(cols.map(function (c) { return d[c.chave + '_fmt']; }));
      if (r.comparado) linha = linha.concat(cols.map(function (c) { return d[c.chave + '_ant_fmt'] || '—'; }));
      linhas.push(linha);
    });
    var total = ['TOTAL'].concat(cols.map(function (c) { return r.totais[c.chave + '_fmt']; }));
    if (r.comparado) total = total.concat(cols.map(function (c) { return r.totais[c.chave + '_ant_fmt'] || '—'; }));
    linhas.push(total);
    return linhas;
  }

  $scope.exportarCSV = function () {
    if (!$scope.resultado) return;
    // ';' e BOM: é o que o Excel em pt-BR abre sem pedir importação.
    var csv = matrizExport().map(function (linha) {
      return linha.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\r\n');
    baixar('﻿' + csv, 'text/csv;charset=utf-8;', nomeArquivo('csv'));
    $scope.painel.exportar = false;
    toast('CSV exportado');
  };

  $scope.exportarExcel = function () {
    if (!$scope.resultado) return;
    var r = $scope.resultado;
    function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
    var html = '<html><head><meta charset="utf-8"></head><body>' +
      '<h3>' + esc(r.grupo + ' · ' + r.nomeDimensao) + ' — ' + esc(r.periodo.rotulo) + '</h3><table border="1">';
    matrizExport().forEach(function (linha, i) {
      html += '<tr>' + linha.map(function (c) { return (i === 0 ? '<th>' : '<td>') + esc(c) + (i === 0 ? '</th>' : '</td>'); }).join('') + '</tr>';
    });
    html += '</table></body></html>';
    baixar(html, 'application/vnd.ms-excel;charset=utf-8;', nomeArquivo('xls'));
    $scope.painel.exportar = false;
    toast('Excel exportado');
  };

  $scope.exportarPNG = function () {
    var canvas = document.getElementById('graficoDim');
    if (!canvas) return;
    // O canvas do Chart.js é transparente: sem um fundo o PNG fica
    // ilegível quando colado em documento branco/escuro.
    var fundo = document.createElement('canvas');
    fundo.width = canvas.width; fundo.height = canvas.height;
    var ctx = fundo.getContext('2d');
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--g-surface').trim() || '#fff';
    ctx.fillRect(0, 0, fundo.width, fundo.height);
    ctx.drawImage(canvas, 0, 0);
    fundo.toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = nomeArquivo('png');
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
    $scope.painel.exportar = false;
    toast('Gráfico exportado');
  };

  $scope.imprimir = function () {
    $scope.painel.exportar = false;
    $timeout(function () { window.print(); }, 120);
  };

  // ══════════════════════════════════════════════════════════
  // Gráficos
  // ══════════════════════════════════════════════════════════
  function css(varname, padrao) {
    var v = getComputedStyle(document.body).getPropertyValue(varname);
    return (v && v.trim()) || padrao;
  }
  function corTexto() { return css('--g-texto-3', '#7b869c'); }
  function corGrade() { return css('--g-border', '#e2e7f0'); }

  function abreviar(v) {
    var abs = Math.abs(v);
    if (abs >= 1e9) return (v / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' bi';
    if (abs >= 1e6) return (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
    if (abs >= 1e3) return (v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
    return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  }

  function eixoValor(tipo, lado, titulo) {
    return {
      type: 'linear', position: lado,
      grid: { color: lado === 'right' ? 'transparent' : corGrade(), drawBorder: false },
      ticks: {
        color: corTexto(), font: { size: 10.5 },
        callback: function (v) { return (tipo === 'moeda' ? 'R$ ' : '') + abreviar(v); }
      },
      title: titulo ? { display: true, text: titulo, color: corTexto(), font: { size: 10 } } : { display: false }
    };
  }

  function tooltipFmt(ctx) {
    var f = ctx.dataset._fmt && ctx.dataset._fmt[ctx.dataIndex];
    return (ctx.dataset.label ? ctx.dataset.label + ': ' : '') + (f != null ? f : ctx.formattedValue);
  }

  function destruir(g) { if (g) { try { g.destroy(); } catch (e) { /* canvas já removido */ } } }

  function desenharEvolucao() {
    var canvas = document.getElementById('graficoEvolucao');
    if (!canvas || !$scope.evolucao || !$scope.evolucao.meses.length) return;
    destruir(graficoEvolucao);

    var ev = $scope.evolucao;
    var datasets = ev.series
      .filter(function (s) { return !$scope.seriesOcultas[s.chave]; })
      .map(function (s) {
        var contagem = s.tipo === 'inteiro';
        return {
          label: s.nome, data: s.dados, borderColor: s.cor, backgroundColor: s.cor + '22',
          yAxisID: contagem ? 'y2' : 'y', tension: .3, borderWidth: 2,
          pointRadius: 2, pointHoverRadius: 5, fill: false, _fmt: s.formatados
        };
      });

    graficoEvolucao = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { labels: ev.meses, datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: tooltipFmt } } },
        scales: {
          x: { grid: { color: corGrade(), drawBorder: false }, ticks: { color: corTexto(), font: { size: 10.5 } } },
          y: eixoValor('moeda', 'left', 'R$'),
          y2: eixoValor('inteiro', 'right', 'quantidade')
        }
      }
    });
  }

  function desenharDimensao() {
    var canvas = document.getElementById('graficoDim');
    var r = $scope.resultado;
    if (!canvas || !r || !r.dados.length) return;
    destruir(graficoDim);

    var linhas = $scope.linhasVisiveis().slice(0, 40);
    var tipo = r.evolucao ? 'linha' : $scope.tipoGrafico;
    var labels = linhas.map(function (d) { return d.label; });
    var valores = linhas.map(function (d) { return d.valorRaw; });
    var fmts = linhas.map(function (d) { return d.valorFormatado; });

    if (tipo === 'rosca' || tipo === 'pizza') {
      graficoDim = new Chart(canvas.getContext('2d'), {
        type: tipo === 'rosca' ? 'doughnut' : 'pie',
        data: {
          labels: labels,
          datasets: [{ data: valores, backgroundColor: paletaCategorica(labels.length), borderWidth: 0, _fmt: fmts }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { color: corTexto(), font: { size: 11 }, boxWidth: 10, usePointStyle: true } },
            tooltip: { callbacks: { label: tooltipFmt } }
          }
        }
      });
      return;
    }

    var horizontal = tipo === 'barra';
    var config = {
      type: tipo === 'linha' ? 'line' : 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: r.nomeIndicador, data: valores,
          backgroundColor: tipo === 'linha' ? r.cor + '25' : r.cor + 'cc',
          borderColor: r.cor, borderWidth: tipo === 'linha' ? 2 : 0,
          borderRadius: tipo === 'linha' ? 0 : 4, tension: .3,
          pointRadius: 2.5, fill: tipo === 'linha', _fmt: fmts
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: horizontal ? 'y' : 'x',
        onClick: function (evt, els) {
          if (!els.length || r.evolucao) return;
          $scope.$applyAsync(function () { $scope.abrirDrill(linhas[els[0].index]); });
        },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: tooltipFmt } } },
        scales: horizontal
          ? {
            x: eixoValor(r.tipo, 'bottom'),
            y: {
              grid: { display: false, drawBorder: false },
              ticks: {
                color: corTexto(), font: { size: 11 }, autoSkip: false,
                callback: function (v) {
                  var l = String(this.getLabelForValue(v));
                  return l.length > 30 ? l.slice(0, 29) + '…' : l;
                }
              }
            }
          }
          : {
            x: {
              grid: { display: false, drawBorder: false },
              ticks: {
                color: corTexto(), font: { size: 10.5 }, maxRotation: 60, minRotation: 0,
                callback: function (v) {
                  var l = String(this.getLabelForValue(v));
                  return l.length > 16 ? l.slice(0, 15) + '…' : l;
                }
              }
            },
            y: eixoValor(r.tipo, 'left')
          }
      }
    };
    graficoDim = new Chart(canvas.getContext('2d'), config);
  }

  // Sequência categórica CVD-safe, a mesma dos painéis de área.
  var PALETA = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#8b5cf6', '#e87ba4', '#0d9488', '#e34948',
    '#4a3aa7', '#b3275f', '#0284c7', '#d97706'];
  function paletaCategorica(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(PALETA[i % PALETA.length]);
    return out;
  }

  function desenharDrill() {
    var canvas = document.getElementById('graficoDrill');
    if (!canvas || !$scope.drill || !$scope.drill.dados) return;
    destruir(graficoDrill);
    var d = $scope.drill.dados;
    var valores = d.dados.map(function (x) { return x.valorRaw; });
    var comMov = valores.filter(function (v) { return v; });
    var media = comMov.length ? comMov.reduce(function (s, v) { return s + v; }, 0) / comMov.length : 0;
    var maior = Math.max.apply(null, valores);
    var menor = Math.min.apply(null, comMov.length ? comMov : valores);

    var datasets = [{
      label: d.nomeIndicador, data: valores,
      // Pico e vale ganham a cor cheia; o resto fica translúcido. É o que
      // faz o melhor e o pior mês saltarem sem legenda nenhuma.
      backgroundColor: valores.map(function (v) {
        return (v === maior || v === menor) ? d.cor : d.cor + '66';
      }),
      borderRadius: 4,
      _fmt: d.dados.map(function (x) { return x.valorFormatado; })
    }];
    if (media) {
      datasets.push({
        type: 'line', label: 'Média mensal',
        data: valores.map(function () { return media; }),
        borderColor: corTexto(), borderWidth: 1.5, borderDash: [6, 4],
        pointRadius: 0, fill: false,
        _fmt: valores.map(function () { return formatarComoIndicador(media, d.tipo); })
      });
    }

    graficoDrill = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: { labels: d.dados.map(function (x) { return mesCurto(x.label); }), datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: tooltipFmt } } },
        scales: {
          x: { grid: { display: false, drawBorder: false }, ticks: { color: corTexto(), font: { size: 10 } } },
          y: eixoValor(d.tipo, 'left')
        }
      }
    });
  }

  function mesCurto(label) {
    var m = /^(\d{4})-(\d{2})$/.exec(String(label || ''));
    return m ? NOMES_MESES[parseInt(m[2], 10) - 1].slice(0, 3) : label;
  }

  function desenharTendencia() {
    var canvas = document.getElementById('graficoTend');
    var t = $scope.tend.dados;
    if (!canvas || !t || !t.dados || !t.dados.length) return;
    destruir(graficoTend);

    var visiveis = $scope.colunasVisiveis().length ? $scope.colunasVisiveis() : t.indicadores;
    var datasets = visiveis.map(function (ind, i) {
      var cor = ind.cor || PALETA[i % PALETA.length];
      return {
        label: ind.nome,
        data: t.dados.map(function (x) { return x[ind.chave]; }),
        borderColor: cor, backgroundColor: cor + '22',
        borderWidth: ind.chave === $scope.indicador ? 2.5 : 1.5,
        tension: .3, pointRadius: 2, pointHoverRadius: 5, fill: false,
        hidden: ind.chave !== $scope.indicador,
        _fmt: t.dados.map(function (x) { return x[ind.chave + '_fmt']; })
      };
    });

    // Ano anterior tracejado: é uma segunda varredura da tabela, então só
    // aparece quando a pessoa pede explicitamente.
    if (t.anterior && t.anterior.dados) {
      datasets.push({
        label: t.ano - 1 + '',
        data: t.anterior.dados.map(function (x) { return x[$scope.indicador]; }),
        borderColor: corTexto(), borderWidth: 1.5, borderDash: [6, 4],
        tension: .3, pointRadius: 0, fill: false,
        _fmt: t.anterior.dados.map(function (x) { return x[$scope.indicador + '_fmt']; })
      });
    }

    graficoTend = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { labels: t.dados.map(function (x) { return mesCurto(x.label); }), datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { color: corTexto(), font: { size: 11 }, boxWidth: 10, usePointStyle: true } },
          tooltip: { callbacks: { label: tooltipFmt } }
        },
        scales: {
          x: { grid: { display: false, drawBorder: false }, ticks: { color: corTexto(), font: { size: 10 } } },
          y: eixoValor(t.tipo, 'left')
        }
      }
    });
  }

  // ══════════════════════════════════════════════════════════
  // Painéis flutuantes e atalhos
  // ══════════════════════════════════════════════════════════
  $scope.abrirPainel = function (nome, ev) {
    if (ev) ev.stopPropagation();
    var estava = $scope.painel[nome];
    Object.keys($scope.painel).forEach(function (k) { $scope.painel[k] = false; });
    $scope.painel[nome] = !estava;
  };
  $scope.fecharPaineis = function () {
    Object.keys($scope.painel).forEach(function (k) { $scope.painel[k] = false; });
  };

  function aoTeclar(ev) {
    var alvo = ev.target || {};
    var digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName || '');

    // Ctrl+K / ⌘K abre a paleta de qualquer lugar — inclusive de dentro de
    // um campo de texto, que é onde a pessoa costuma estar quando desiste
    // de procurar no menu.
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'k' || ev.key === 'K')) {
      ev.preventDefault();
      $scope.$applyAsync($scope.abrirPalheta);
      return;
    }

    if ($scope.palheta.aberta) {
      if (ev.key === 'Escape') { ev.preventDefault(); $scope.$applyAsync($scope.fecharPalheta); return; }
      if (ev.key === 'ArrowDown') { ev.preventDefault(); $scope.$applyAsync(function () { moverPalheta(1); }); return; }
      if (ev.key === 'ArrowUp') { ev.preventDefault(); $scope.$applyAsync(function () { moverPalheta(-1); }); return; }
      if (ev.key === 'Enter') {
        ev.preventDefault();
        $scope.$applyAsync(function () {
          var r = $scope.palheta.resultados[$scope.palheta.sel];
          if (r) $scope.abrirDaPalheta(r);
        });
        return;
      }
      return; // qualquer outra tecla é digitação na paleta
    }

    if (ev.key === 'Escape') {
      $scope.$applyAsync(function () {
        if ($scope.drill) $scope.fecharDrill();
        else $scope.fecharPaineis();
      });
      return;
    }
    if (digitando) return;

    // Tudo daqui para baixo chama preventDefault. Sem esta guarda, Ctrl+R,
    // Ctrl+P, Ctrl+A, Ctrl+D e Ctrl+1..9 do NAVEGADOR ficavam bloqueados
    // pelo painel — o atalho errado engolia o atalho de sistema.
    // Shift NÃO entra aqui: '?' é Shift+/ na maioria dos teclados.
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

    // 1…9 vai direto para a área naquela posição.
    if (/^[1-9]$/.test(ev.key)) {
      var areas = ($scope.catalogo && $scope.catalogo.areas) || [];
      var alvoArea = areas[parseInt(ev.key, 10) - 1];
      if (alvoArea) {
        ev.preventDefault();
        $scope.$applyAsync(function () { $scope.selecionarArea(alvoArea.id); });
      }
      return;
    }

    // Sempre ativos: são os únicos que não colidem com a navegação rápida
    // de leitor de tela (onde b = botão, t = tabela, d = landmark).
    var sempre = {
      '/': function () {
        var campo = document.getElementById('buscaMenu');
        if (campo) campo.focus();
      },
      '?': function () { $scope.abrirPainel('atalhos'); }
    };
    var deUmaTecla = {
      'b': function () { $scope.alternarMenu(); },
      't': function () { $scope.alternarTema(); },
      'c': function () { $scope.alternarComparar(); },
      'e': function () { $scope.exportarCSV(); },
      'p': function () { $scope.imprimir(); },
      'r': function () { $scope.recarregar(); },
      'a': function () { $scope.alternarAnomalias(); },
      'd': function () { $scope.alternarCompacta(); }
    };

    var acao = sempre[ev.key] || ($scope.atalhosTecla ? deUmaTecla[ev.key] : null);
    if (acao) {
      ev.preventDefault();
      $scope.$applyAsync(acao);
    }
  }
  document.addEventListener('keydown', aoTeclar);

  // Abas como tablist: roving tabindex faz a faixa inteira ser um único
  // stop de Tab, e as setas andam entre elas.
  $scope.aoTeclarAbas = function (ev, indice) {
    var areas = ($scope.catalogo && $scope.catalogo.areas) || [];
    if (!areas.length) return;
    var destino = null;
    if (ev.key === 'ArrowRight') destino = (indice + 1) % areas.length;
    else if (ev.key === 'ArrowLeft') destino = (indice - 1 + areas.length) % areas.length;
    else if (ev.key === 'Home') destino = 0;
    else if (ev.key === 'End') destino = areas.length - 1;
    if (destino === null) return;
    ev.preventDefault();
    $scope.selecionarArea(areas[destino].id);
    $timeout(function () {
      var el = document.getElementById('aba-' + areas[destino].id);
      if (el) el.focus();
    });
  };

  angular.element(window).on('resize', function () {
    $timeout(redesenharGraficos, 160);
  });

  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var aoMudarSistema = function () { if ($scope.tema === 'auto') $scope.$applyAsync(aplicarTema); };
    if (mq.addEventListener) mq.addEventListener('change', aoMudarSistema);
    else if (mq.addListener) mq.addListener(aoMudarSistema);
  }

  // ══════════════════════════════════════════════════════════
  // Boot com cache
  // ══════════════════════════════════════════════════════════
  // Roda FORA de digest (corpo do controller), então nada de $apply aqui:
  // só atribuição, e $timeout para desenhar. Aplicado uma única vez — a
  // resposta real de carregarCatalogo sobrescreve tudo por cima.
  (function aplicarCacheInicial() {
    var cat = lerCache('cat', VERSAO_CACHE);
    if (!cat) return;
    aplicarCatalogo(cat.res);
    marcarCache(cat.quando);

    var estado = lerEstadoDaUrl();
    var inicial = (estado.dim && dimensoesPorId[estado.dim]) ||
      dimensoesPorId[ler('ultimaDimensao', '')];
    if (estado.ano) $scope.ano = estado.ano;
    if (estado.mes != null) $scope.mes = estado.mes;
    if (estado.dia) $scope.dia = estado.dia;
    if (estado.area && areasPorId[estado.area]) $scope.area = estado.area;
    else if (!areasPorId[$scope.area]) $scope.area = 'geral';

    recalcularArea();
    recalcularFavoritos();
    recalcularRecentes();
    recalcularMenu();
    preencherBlocosDoCache();

    if (!inicial) return;
    $scope.dimensao = inicial;
    $scope.indicador = (estado.ind && indicadorValido(inicial, estado.ind)) ? estado.ind : inicial.indicadorPadrao;

    var salvo = lerCache('dim', assinaturaDados());
    if (salvo) {
      $scope.resultado = salvo.res;
      calcularAnomalias();
    }
    var evol = lerCache('evol', assinaturaPeriodo());
    if (evol) $scope.evolucao = evol.res;
    $timeout(redesenharGraficos);
  }());

  $scope.$on('$destroy', function () {
    document.removeEventListener('keydown', aoTeclar);
    destruir(graficoEvolucao); destruir(graficoDim); destruir(graficoDrill); destruir(graficoTend);
  });
});
