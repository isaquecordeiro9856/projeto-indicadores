var app = angular.module('DashboardApp');


  // ----------------------------------------------------------------------
  // CONTROLLER PRINCIPAL DO DASHBOARD
  // ----------------------------------------------------------------------
  app.controller('DashboardController', function($scope, $timeout, $q, ApiService) {
    
    // ANOS DISPONÍVEIS
    $scope.listaAnos = [];
    const anoAtual = new Date().getFullYear();
    for (let ano = 2021; ano <= anoAtual; ano++) $scope.listaAnos.push(ano);

    // ESTADO INICIAL: CONVÊNIO + MATRIZ MULTIVARIADA (TODOS)
    $scope.config = { 
      dimensao: 'convenio', 
      indicador: 'todos' 
    };

    $scope.filtroSidebar = "";
    $scope.filtrosBusca = { tabela: "" };
    $scope.sidebarColapsada = false;
    $scope.toastMensagem = null;
    $scope.dataEmissaoImpressao = new Date().toLocaleString('pt-BR');

    let dataHoje = new Date();

    // Helper: $apply seguro (evita "$digest already in progress")
    function safeApply(fn) {
      if ($scope.$phase || ($scope.$root && $scope.$root.$phase)) {
        if (fn) $scope.$eval(fn);
      } else {
        $scope.$apply(fn);
      }
    }
    function isValidDate(d) { return d instanceof Date && !isNaN(d.getTime()); }

    function criarDateMes(ano, mes0indexed) {
      return new Date(ano, mes0indexed, 1);
    }

    $scope.filtrosTop = { 
      tipoPeriodo: 'mes', 
      dataDia: new Date(dataHoje.getFullYear(), dataHoje.getMonth(), dataHoje.getDate()),
      dataMes: criarDateMes(dataHoje.getFullYear(), dataHoje.getMonth()),
      dataAno: anoAtual,
      limite: '10', 
      modoVisao: 'normal', 
      ordem: 'desc' 
    };

    $scope.infoPeriodo = {
      rotuloAtual: '',
      rotuloAnterior: ''
    };

    // ----------------------------------------------------------------------
    // PERSISTÊNCIA DE ESTADO (localStorage) + RESPONSIVIDADE INICIAL
    // ----------------------------------------------------------------------
    var CHAVE_ESTADO = 'pempfrg_dashboard_estado_v1';
    var CHAVE_COLUNAS = 'pempfrg_dashboard_colunas_v1';
    var CHAVE_TEMA = 'pempfrg_dashboard_tema_v1';

    // Listas canônicas de validação (fonte única — evita divergência)
    var DIMENSOES_VALIDAS = ['estabelecimento', 'setor', 'tipo_convenio', 'convenio', 'tipo_atendimento', 'medico_executor', 'paciente', 'grupo_procedimentos', 'tipo_procedimentos', 'procedimentos', 'grupo_matmed', 'tipo_matmed', 'matmed'];
    var INDICADORES_VALIDOS = ['todos', 'qtd_contas', 'qtd_procedimentos', 'qtd_matmed', 'valor_produzido', 'valor_faturado', 'valor_recebido', 'valor_glosado', 'valor_adicional', 'valor_medico'];
    var MODOS_VISAO_VALIDOS = ['normal', 'comparativo', 'yoy'];

    // --------------------------------------------------------------------
    // TEMA CLARO/ESCURO
    // --------------------------------------------------------------------
    function aplicarTemaInicial() {
      var tema = null;
      try { tema = localStorage.getItem(CHAVE_TEMA); } catch (e) { }
      if (!tema && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) tema = 'dark';
      document.documentElement.setAttribute('data-theme', tema === 'dark' ? 'dark' : 'light');
    }
    aplicarTemaInicial();
    $scope.temaEscuro = document.documentElement.getAttribute('data-theme') === 'dark';

    function coresGrafico() {
      var escuro = document.documentElement.getAttribute('data-theme') === 'dark';
      return {
        rotulo: escuro ? '#e2e8f0' : '#1e293b',
        tick: escuro ? '#94a3b8' : '#64748b',
        grid: escuro ? '#1e2c47' : '#f1f5f9',
        legenda: escuro ? '#e2e8f0' : '#1e293b',
        tooltipBg: escuro ? '#0b1220' : '#0f172a',
        barraAnterior: escuro ? '#64748b' : '#94a3b8',
        bordaRosca: escuro ? '#111c31' : '#ffffff',
        rotuloValor: escuro ? '#cbd5e1' : '#334155'
      };
    }

    // Cor de cada indicador adaptada ao tema (tons claros no escuro)
    var PALETA_ESCURA_INDICADORES = {
      qtd_contas: '#94a3b8',
      qtd_procedimentos: '#67d3fb',
      qtd_matmed: '#c4b5fd',
      valor_produzido: '#fbbf24',
      valor_faturado: '#7cb5ff',
      valor_recebido: '#4ade80',
      valor_glosado: '#f87171',
      valor_adicional: '#fb7185',
      valor_medico: '#d8b4fe',
      taxa_glosa: '#f87171'
    };

    function corDeIndicador(chave, corPadrao) {
      var escuro = document.documentElement.getAttribute('data-theme') === 'dark';
      return escuro && PALETA_ESCURA_INDICADORES[chave] ? PALETA_ESCURA_INDICADORES[chave] : corPadrao;
    }

    $scope.alternarTema = function() {
      var novoTema = $scope.temaEscuro ? 'light' : 'dark';
      $scope.temaEscuro = novoTema === 'dark';
      document.documentElement.setAttribute('data-theme', novoTema);
      try { localStorage.setItem(CHAVE_TEMA, novoTema); } catch (e) { }
      if ($scope.respostaBackend) {
        $timeout(function() {
          renderizarGraficos($scope.respostaBackend);
          renderizarTendencia();
        }, 30);
      }
    };

    function formatarDataISO(d) {
      var m = d.getMonth() + 1, dia = d.getDate();
      return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dia < 10 ? '0' : '') + dia;
    }

    function formatarMesISO(d) {
      var m = d.getMonth() + 1;
      return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m;
    }

    function salvarEstado() {
      try {
        var f = $scope.filtrosTop;
        localStorage.setItem(CHAVE_ESTADO, JSON.stringify({
          dimensao: $scope.config.dimensao,
          indicador: $scope.config.indicador,
          tipoPeriodo: f.tipoPeriodo,
          modoVisao: f.modoVisao,
          ordem: f.ordem,
          limite: f.limite,
          dataAno: f.dataAno,
          dataDia: f.dataDia instanceof Date ? formatarDataISO(f.dataDia) : null,
          dataMes: f.dataMes instanceof Date ? formatarMesISO(f.dataMes) : null,
          tipoGrafico: $scope.tipoGraficoVisual,
          serieGrafico: $scope.filtroSerieGrafico
        }));
      } catch (e) { /* armazenamento indisponível: segue sem persistir */ }
    }

    function restaurarEstadoSalvo() {
      try {
        var salvo = JSON.parse(localStorage.getItem(CHAVE_ESTADO) || 'null');
        if (salvo) {
          if (DIMENSOES_VALIDAS.indexOf(salvo.dimensao) !== -1) $scope.config.dimensao = salvo.dimensao;
          if (INDICADORES_VALIDOS.indexOf(salvo.indicador) !== -1) $scope.config.indicador = salvo.indicador;
          if (['dia', 'mes', 'ano'].indexOf(salvo.tipoPeriodo) !== -1) $scope.filtrosTop.tipoPeriodo = salvo.tipoPeriodo;
          if (MODOS_VISAO_VALIDOS.indexOf(salvo.modoVisao) !== -1) $scope.filtrosTop.modoVisao = salvo.modoVisao;
          if (['asc', 'desc'].indexOf(salvo.ordem) !== -1) $scope.filtrosTop.ordem = salvo.ordem;
          if (salvo.limite && ['5','10','25','50','todos'].indexOf(String(salvo.limite)) !== -1) $scope.filtrosTop.limite = String(salvo.limite);
          if (typeof salvo.dataAno === 'number' && salvo.dataAno >= 2000 && salvo.dataAno <= 2100) $scope.filtrosTop.dataAno = salvo.dataAno;

          if (typeof salvo.dataDia === 'string') {
            var p = salvo.dataDia.split('-');
            if (p.length === 3 && !isNaN(Date.parse(salvo.dataDia))) {
              $scope.filtrosTop.dataDia = new Date(+p[0], +p[1] - 1, +p[2]);
            }
          }
          if (typeof salvo.dataMes === 'string') {
            var pm = salvo.dataMes.split('-');
            if (pm.length === 2) $scope.filtrosTop.dataMes = new Date(+pm[0], +pm[1] - 1, 1);
          }
        }
      } catch (e) { /* estado corrompido: usa padrões */ }

      // Em telas reduzidas o menu lateral inicia recolhido (drawer)
      if (window.innerWidth <= 940) $scope.sidebarColapsada = true;
    }

    restaurarEstadoSalvo();

    // Link compartilhado (#hash) tem prioridade sobre o estado salvo
    parseHashEstado();

    // COLUNAS DA TABELA MULTIVARIADA (VISIBILIDADE CONFIGURÁVEL)
    // "taxa_glosa" é uma coluna derivada (valor_glosado ÷ valor_faturado)
    $scope.definicaoColunas = [
      { key: 'qtd_contas',        rotulo: 'Qtd. Contas',       badgeClass: 'badge-qtd-contas' },
      { key: 'qtd_procedimentos', rotulo: 'Qtd. Proc.',        badgeClass: 'badge-qtd-proc' },
      { key: 'qtd_matmed',        rotulo: 'Qtd. Mat/Med',      badgeClass: 'badge-qtd-matmed' },
      { key: 'valor_produzido',   rotulo: 'Val. Produzido',    badgeClass: 'badge-val-produzido' },
      { key: 'valor_faturado',    rotulo: 'Val. Faturado',     badgeClass: 'badge-val-faturado' },
      { key: 'valor_recebido',    rotulo: 'Val. Recebido',     badgeClass: 'badge-val-recebido' },
      { key: 'valor_glosado',     rotulo: 'Val. Glosado',      badgeClass: 'badge-val-glosado',       inverterDelta: true },
      { key: 'taxa_glosa',        rotulo: '% Glosa',           badgeClass: 'badge-glosa-rate',        inverterDelta: true, isPercentual: true },
      { key: 'valor_adicional',   rotulo: 'Val. Adicional',    badgeClass: 'badge-val-adicional' },
      { key: 'valor_medico',      rotulo: 'Val. Repasse Méd.', badgeClass: 'badge-val-medico' }
    ];

    $scope.colunasVisiveis = {};
    $scope.definicaoColunas.forEach(function(c) { $scope.colunasVisiveis[c.key] = true; });
    $scope.painelColunasAberto = false;

    try {
      var colunasSalvas = JSON.parse(localStorage.getItem(CHAVE_COLUNAS) || 'null');
      if (colunasSalvas) {
        $scope.definicaoColunas.forEach(function(c) {
          if (typeof colunasSalvas[c.key] === 'boolean') $scope.colunasVisiveis[c.key] = colunasSalvas[c.key];
        });
      }
    } catch (e) { /* ignora */ }

    $scope.getColunasVisiveis = function() {
      return $scope.definicaoColunas.filter(function(c) { return $scope.colunasVisiveis[c.key]; });
    };

    $scope.salvarColunas = function() {
      try { localStorage.setItem(CHAVE_COLUNAS, JSON.stringify($scope.colunasVisiveis)); } catch (e) { /* ignora */ }
    };

    $scope.tipoGraficoVisual = 'horizontalBar';
    $scope.filtroSerieGrafico = 'todos';

    // Restaura preferências visuais salvas (após os defaults)
    try {
      var prefsVisuais = JSON.parse(localStorage.getItem(CHAVE_ESTADO) || 'null');
      if (prefsVisuais) {
        if (['horizontalBar', 'bar', 'doughnut'].indexOf(prefsVisuais.tipoGrafico) !== -1) $scope.tipoGraficoVisual = prefsVisuais.tipoGrafico;
        if (prefsVisuais.serieGrafico) $scope.filtroSerieGrafico = prefsVisuais.serieGrafico;
      }
    } catch (e) { /* ignora */ }

    $scope.carregando = false;
    $scope.erroCarregamento = false;
    $scope.respostaBackend = null;
    $scope.dadosFiltradosTabela = [];
    $scope.kpis = {};
    $scope.totalParticipacao = 0;
    $scope.toastTipo = null;

    // Classe do badge de taxa de glosa (baixa / média / alta)
    // Definição canônica adiante — respeita a meta configurada

    // Cor do Δ% inline: verde quando a variação é favorável
    // (invertido para glosas — aumento é ruim)
    $scope.classeDelta = function(item, col) {
      var v = item ? item[col.key + '_var'] : null;
      if (v == null || v === 0) return 'delta-neutro';
      var favoravel = (v > 0) !== !!col.inverterDelta;
      return favoravel ? 'text-green' : 'text-red';
    };

    // ORDENAÇÃO DE 3 ESTADOS
    $scope.colunaOrdenada = null;
    $scope.direcaoOrdenacao = null; 
    $scope.dadosOriginais = null;

    let debounceTimer = null;
    let toastTimer = null;
    let chart1 = null;
    let chart2 = null;

    // ------------------------------------------------------------------
    // AÇÕES DE UI & SIDEBAR RETRÁTIL
    // ------------------------------------------------------------------
    $scope.toggleSidebar = function() {
      $scope.sidebarColapsada = !$scope.sidebarColapsada;
      $timeout(function() {
        if (chart1) chart1.resize();
        if (chart2) chart2.resize();
      }, 300);
    };

    $scope.selecionarDimensao = function(dim) {
      $scope.config.dimensao = dim;
      if (window.innerWidth <= 940 && !$scope.sidebarColapsada) $scope.sidebarColapsada = true;
    };

    $scope.selecionarIndicador = function(ind) {
      $scope.config.indicador = ind;
      if (window.innerWidth <= 940 && !$scope.sidebarColapsada) $scope.sidebarColapsada = true;
    };

    $scope.limparBuscaTabela = function() {
      $scope.filtrosBusca.tabela = '';
      $scope.aplicarFiltroTabela();
    };

    // MENU DE EXPORTAÇÃO UNIFICADO (CSV / CSV COMPLETO / EXCEL)
    $scope.menuExportarAberto = false;

    $scope.executarExportacao = function(tipo) {
      $scope.menuExportarAberto = false;
      if (tipo === 'csv') $scope.exportarCSV();
      else if (tipo === 'csv_completo') $scope.exportarCSVCompleto();
      else if (tipo === 'excel') $scope.exportarExcel();
      else if (tipo === 'png') $scope.exportarPNG();
    };

    // EXPORTAÇÃO DO GRÁFICO PRINCIPAL EM PNG
    $scope.exportarPNG = function() {
      if (!chart1) {
        $scope.mostrarToast('Nenhum gráfico disponível para exportar.', 'erro');
        return;
      }
      try {
        var link = document.createElement('a');
        link.download = 'Tasy_Pempfrg_' + $scope.config.dimensao + '_' + new Date().toISOString().substring(0, 10) + '.png';
        link.href = chart1.toBase64Image('image/png', 1);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        $scope.mostrarToast('Imagem PNG do gráfico gerada!', 'sucesso');
      } catch (e) {
        $scope.mostrarToast('Não foi possível gerar a imagem do gráfico.', 'erro');
      }
    };

    $scope.fecharMenusFlutuantes = function() {
      var fechou = false;
      if ($scope.menuExportarAberto) { $scope.menuExportarAberto = false; fechou = true; }
      if ($scope.painelColunasAberto) { $scope.painelColunasAberto = false; fechou = true; }
      if ($scope.menuViewsAberto) { $scope.menuViewsAberto = false; fechou = true; }
      if ($scope.painelMetasAberto) { $scope.painelMetasAberto = false; fechou = true; }
      if ($scope.painelDicionarioAberto) { $scope.painelDicionarioAberto = false; fechou = true; }
      return fechou;
    };

    // Alterna (ou força) flags de painéis flutuantes SEMPRE no escopo do
    // controller — a atribuição inline em ng-click criaria cópia sombreada
    // nos escopos-filho do ng-if, e clique-fora/Esc/reset não fechariam.
    $scope.alternarPainel = function(nome, forcar) {
      $scope[nome] = (forcar === undefined) ? !$scope[nome] : !!forcar;
    };

    // Fecha dropdowns ao clicar fora deles (handler único)
    var handlerClickFora = function(ev) {
      var alvo = ev.target;
      if (!alvo || !alvo.closest) return;
      if (!alvo.closest('.exportar-dropdown') && !alvo.closest('.colunas-dropdown') &&
          !alvo.closest('.views-dropdown') && !alvo.closest('.metas-bar') &&
          !alvo.closest('.btn-dicionario') && !alvo.closest('.dicionario-panel')) {
        safeApply(function() { $scope.fecharMenusFlutuantes(); });
      }
    };
    document.addEventListener('click', handlerClickFora);

    // DETECÇÃO DINÂMICA DO PRESET ATIVO (COMPARA FILTROS COM A DEFINIÇÃO)
    $scope.isPresetAtivo = function(preset) {
      var hoje = new Date();
      var f = $scope.filtrosTop;

      if (preset === 'hoje') {
        return f.tipoPeriodo === 'dia' && f.dataDia instanceof Date &&
          f.dataDia.getFullYear() === hoje.getFullYear() &&
          f.dataDia.getMonth() === hoje.getMonth() &&
          f.dataDia.getDate() === hoje.getDate();
      }
      if (preset === 'este_mes') {
        return f.tipoPeriodo === 'mes' && f.dataMes instanceof Date &&
          f.dataMes.getFullYear() === hoje.getFullYear() &&
          f.dataMes.getMonth() === hoje.getMonth();
      }
      if (preset === 'mes_anterior') {
        if (f.tipoPeriodo !== 'mes' || !(f.dataMes instanceof Date)) return false;
        var ref = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        return f.dataMes.getFullYear() === ref.getFullYear() &&
          f.dataMes.getMonth() === ref.getMonth();
      }
      if (preset === 'ano_atual') {
        return f.tipoPeriodo === 'ano' && parseInt(f.dataAno, 10) === hoje.getFullYear();
      }
      return false;
    };

    $scope.inverterOrdenacaoGrafico = function() {
      $scope.filtrosTop.ordem = $scope.filtrosTop.ordem === 'desc' ? 'asc' : 'desc';
      $scope.aplicarOrdenacaoPadrao();
    };

    // Base completa recebida em segundo plano (quando o Top-N corta registros).
    // Permite reconstruir a exibição com os VERDADEIROS extremos da base,
    // em vez de apenas reordenar o recorte já carregado.
    var baseCompletaDados = null;

    function obterBaseParaExtremos() {
      var exibidos = $scope.dadosOriginais || [];
      if (baseCompletaDados && baseCompletaDados.length > exibidos.length) return baseCompletaDados;
      return exibidos.length ? exibidos : (($scope.respostaBackend && $scope.respostaBackend.dados) || []);
    }

    // Reconstrói o conjunto exibido a partir da base mais ampla disponível:
    // - sem coluna ativa → métrica padrão na direção do seletor "Ordenação";
    // - com coluna ativa  → verdadeiro Top-N (menores/maiores) daquela coluna.
    function reconstruirExibicao() {
      var res = $scope.respostaBackend;
      if (!res || !res.dados || !$scope.dadosOriginais) return;

      var campo, desc;

      if ($scope.colunaOrdenada && $scope.direcaoOrdenacao) {
        campo = $scope.colunaOrdenada;
        desc = $scope.direcaoOrdenacao !== 'asc';
      } else {
        campo = res.modoTodos ? 'valorRawSort' : 'valorRaw';
        desc = $scope.filtrosTop.ordem !== 'asc';
      }

      var arr = obterBaseParaExtremos().slice();

      arr.sort(function(a, b) {
        if (campo === 'label') {
          return String(a.label || '').localeCompare(String(b.label || ''), 'pt-BR', { sensitivity: 'base' }) * (desc ? -1 : 1);
        }
        var va = a[campo], vb = b[campo];
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        if (typeof va === 'string' || typeof vb === 'string') {
          return String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' }) * (desc ? -1 : 1);
        }
        return desc ? vb - va : va - vb;
      });

      var n = ($scope.filtrosTop.limite !== 'todos') ? parseInt($scope.filtrosTop.limite, 10) || arr.length : arr.length;
      if (arr.length > n) arr = arr.slice(0, n);

      res.dados = arr;
      $scope.dadosOriginais = arr.slice();

      marcarAnomalias(arr, res.modoTodos);
      $scope.calcularMaioresVariacoes();
      $scope.aplicarFiltroTabela();
      calcularKPIs(res);
      // No 1º carregamento os canvases ainda não existem (ng-if pendente);
      // nesse caso o render fica por conta do $timeout do fluxo de carga.
      if (document.getElementById('chartPrincipal')) renderizarGraficos(res);
    }

    // Reaplica a visão padrão (métrica principal × direção do seletor),
    // puxando os extremos reais da base quando o Top-N está ativo.
    $scope.aplicarOrdenacaoPadrao = function() {
      if (!$scope.respostaBackend || !$scope.dadosOriginais) return;

      $scope.colunaOrdenada = null;
      $scope.direcaoOrdenacao = null;
      reconstruirExibicao();
    };

    $scope.tentarNovamente = function() {
      $scope.erroCarregamento = false;
      solicitarDados();
    };

    // Suporte a teclado (Enter/Espaço) em elementos role="button"
    $scope.ativarTecla = function(e, fn, arg) {
      if (e.keyCode === 13 || e.keyCode === 32) {
        e.preventDefault();
        fn(arg);
      }
    };

    $scope.mostrarToast = function(msg, tipo) {
      if (toastTimer) $timeout.cancel(toastTimer);
      $scope.toastMensagem = msg;
      $scope.toastTipo = tipo || 'info';
      toastTimer = $timeout(function() {
        $scope.toastMensagem = null;
        $scope.toastTipo = null;
      }, 3500);
    };

    // PRESETS RÁPIDOS DE DATA
    $scope.aplicarPreset = function(preset) {
      let hoje = new Date();
      if (preset === 'hoje') {
        $scope.filtrosTop.tipoPeriodo = 'dia';
        $scope.filtrosTop.dataDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      } else if (preset === 'este_mes') {
        $scope.filtrosTop.tipoPeriodo = 'mes';
        $scope.filtrosTop.dataMes = criarDateMes(hoje.getFullYear(), hoje.getMonth());
      } else if (preset === 'mes_anterior') {
        $scope.filtrosTop.tipoPeriodo = 'mes';
        let mesAnt = hoje.getMonth() === 0 ? 11 : hoje.getMonth() - 1;
        let anoAnt = hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear();
        $scope.filtrosTop.dataMes = criarDateMes(anoAnt, mesAnt);
      } else if (preset === 'ano_atual') {
        $scope.filtrosTop.tipoPeriodo = 'ano';
        $scope.filtrosTop.dataAno = hoje.getFullYear();
      }
      atualizarRotulosPeriodo();
    };

    // ALTERNAR TIPO DE GRÁFICO
    function isTipoGraficoValido(t) { return ['horizontalBar','bar','doughnut'].indexOf(t) !== -1; }
    $scope.alterarTipoGrafico = function(tipo) {
      if (!isTipoGraficoValido(tipo)) return;
      $scope.tipoGraficoVisual = tipo;
      salvarEstado();
      if ($scope.respostaBackend) {
        $timeout(function() { renderizarGraficos($scope.respostaBackend); }, 50);
      }
    };

    $scope.filtrarSeriesGrafico = function(filtro) {
      $scope.filtroSerieGrafico = filtro;
      salvarEstado();
      if ($scope.respostaBackend) {
        $timeout(function() { renderizarGraficos($scope.respostaBackend); }, 50);
      }
    };

    // Normalização compartilhada (minúsculas + sem acentos)
    function cssEscapeFallback(s) {
      return String(s).replace(/[^a-zA-Z0-9_-]/g, function(ch){ return '\\' + ch; });
    }
    function normalizarTexto(txt) {
      return txt ? txt.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
    }

    // FILTRO DINÂMICO DA SIDEBAR
    $scope.filtrarItem = function(nome) {
      if (!$scope.filtroSidebar) return true;
      if (!nome) return false;
      return normalizarTexto(nome).indexOf(normalizarTexto($scope.filtroSidebar)) !== -1;
    };

    // HELPERS DE FORMATAÇÃO PARA TOTAIS
    function fmtMoedaTotal(v) { return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
    function fmtIntTotal(v) { return Math.round(v || 0).toLocaleString('pt-BR'); }
    function fmtPctTotal(v) { return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + '%'; }

    // Formato curto compartilhado (eixos, rótulos de barra e tooltips)
    function fmtValorCurto(v, isMoeda, isPercentual) {
      if (isPercentual) return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
      if (isMoeda) {
        if (Math.abs(v) >= 1000000) return 'R$ ' + (v / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'M';
        if (Math.abs(v) >= 1000) return 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + 'k';
        return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
      }
      return Math.round(v).toLocaleString('pt-BR');
    }

    function formatarTotalPorChave(key, valor, cfgMap) {
      var cfg = cfgMap[key];
      if (!cfg) return fmtIntTotal(valor);
      if (cfg.isPercentual) return fmtPctTotal(valor);
      if (cfg.isMoeda) return fmtMoedaTotal(valor);
      return fmtIntTotal(valor);
    }

    // FILTRO DINÂMICO EM TEMPO REAL DA TABELA
    $scope.aplicarFiltroTabela = function() {
      if (!$scope.respostaBackend || !$scope.respostaBackend.dados || !$scope.respostaBackend.dados.length) {
        $scope.dadosFiltradosTabela = [];
        $scope.totaisTabela = {};
        return;
      }

      if (!$scope.filtrosBusca.tabela) {
        $scope.dadosFiltradosTabela = $scope.respostaBackend.dados;
      } else {
        var termo = normalizarTexto($scope.filtrosBusca.tabela);
        $scope.dadosFiltradosTabela = $scope.respostaBackend.dados.filter(function(item) {
          return item.label && normalizarTexto(item.label).indexOf(termo) !== -1;
        });
      }

      calcularTotaisTabela();
    };

    // TOTAIS DO RODAPÉ — somas diretas e percentuais agregados por razão
    function calcularTotaisTabela() {
      var lista = $scope.dadosFiltradosTabela || [];
      var res = $scope.respostaBackend;
      var t = {};
      var cfgMap = ApiService.getConfigIndicadores();

      if (!res.modoTodos) {
        t.valorRaw = lista.reduce(function(acc, it) { return acc + (it.valorRaw || 0); }, 0);
        t.anteriorRaw = lista.reduce(function(acc, it) { return acc + (it.valorAnteriorRaw || 0); }, 0);
        t.valorFormatado = res.isPercentual ? fmtPctTotal(lista.length > 0 ? t.valorRaw / lista.length : 0)
          : (res.isMoeda ? fmtMoedaTotal(t.valorRaw) : fmtIntTotal(t.valorRaw));
        t.anteriorFormatado = res.isPercentual ? fmtPctTotal(lista.length > 0 ? t.anteriorRaw / lista.length : 0)
          : (res.isMoeda ? fmtMoedaTotal(t.anteriorRaw) : fmtIntTotal(t.anteriorRaw));
        t.variacao = t.anteriorRaw > 0 ? ((t.valorRaw - t.anteriorRaw) / t.anteriorRaw) * 100 : 0;
        t.participacao = $scope.totalParticipacao > 0 ? (t.valorRaw / $scope.totalParticipacao) * 100 : 0;
      } else {
        var chavesValor = ['qtd_contas', 'qtd_procedimentos', 'qtd_matmed', 'valor_produzido', 'valor_faturado', 'valor_recebido', 'valor_glosado', 'valor_adicional', 'valor_medico'];
        chavesValor.forEach(function(k) { t[k] = 0; });

        lista.forEach(function(it) {
          chavesValor.forEach(function(k) { t[k] += (it[k] || 0); });
        });

        // Percentuais agregados por razão (não por média simples)
        var fat = t.valor_faturado;
        t.taxa_glosa = fat > 0 ? (t.valor_glosado / fat) * 100 : 0;

        Object.keys(cfgMap).forEach(function(k) {
          t[k + '_fmt'] = formatarTotalPorChave(k, t[k] != null ? t[k] : 0, cfgMap);
        });
        t.taxa_glosa_fmt = fmtPctTotal(t.taxa_glosa);
      }

      $scope.totaisTabela = t;
    }

    // PARTICIPAÇÃO PERCENTUAL NO TOTAL (total pré-computado: O(1) por linha)
    $scope.calcularParticipacaoPercentual = function(valor) {
      if (!$scope.totalParticipacao) return 0;
      return (valor / $scope.totalParticipacao) * 100;
    };

    // ----------------------------------------------------------------------
    // CÁLCULO DE PERÍODOS PRECISOS
    // ----------------------------------------------------------------------
    function atualizarRotulosPeriodo() {
      const mesesNomes = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];

      if ($scope.filtrosTop.tipoPeriodo === 'dia') {
        let d = $scope.filtrosTop.dataDia instanceof Date
          ? new Date($scope.filtrosTop.dataDia.getFullYear(), $scope.filtrosTop.dataDia.getMonth(), $scope.filtrosTop.dataDia.getDate())
          : new Date();
        let diaAnt = new Date(d);
        diaAnt.setDate(diaAnt.getDate() - 1);
        let diaYoy = new Date(d);
        diaYoy.setFullYear(diaYoy.getFullYear() - 1);

        if ($scope.filtrosTop.modoVisao === 'yoy') {
          $scope.infoPeriodo.rotuloAnterior = diaYoy.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' (Mesmo Dia do Ano Passado)';
        } else {
          $scope.infoPeriodo.rotuloAnterior = diaAnt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' (Dia Anterior)';
        }

        $scope.infoPeriodo.rotuloAtual    = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

      } else if ($scope.filtrosTop.tipoPeriodo === 'mes') {
        let dm = $scope.filtrosTop.dataMes instanceof Date ? $scope.filtrosTop.dataMes : new Date();
        let anoNum = dm.getFullYear();
        let mesNum = dm.getMonth();

        $scope.infoPeriodo.rotuloAtual = `${mesesNomes[mesNum]} / ${anoNum}`;

        let mesAntNum = mesNum === 0 ? 11 : mesNum - 1;
        let anoAntNum = mesNum === 0 ? anoNum - 1 : anoNum;

        if ($scope.filtrosTop.modoVisao === 'yoy') {
          $scope.infoPeriodo.rotuloAnterior = `${mesesNomes[mesNum]} / ${anoNum - 1} (Mesmo Mês do Ano Passado)`;
        } else {
          $scope.infoPeriodo.rotuloAnterior = `${mesesNomes[mesAntNum]} / ${anoAntNum} (Mês Anterior)`;
        }

      } else if ($scope.filtrosTop.tipoPeriodo === 'ano') {
        let anoNum = parseInt($scope.filtrosTop.dataAno) || new Date().getFullYear();
        $scope.infoPeriodo.rotuloAtual    = `Ano ${anoNum}`;
        $scope.infoPeriodo.rotuloAnterior = `Ano ${anoNum - 1} (Ano Anterior)`;
      }
    }

    // Desloca o período efetivo em N anos (para o comparativo YoY)
    function deslocarPeriodoAnos(tipoPeriodo, valor, anos) {
      if (tipoPeriodo === 'ano') return (parseInt(valor, 10) || new Date().getFullYear()) + anos;
      if (valor instanceof Date) {
        var d = new Date(valor.getTime());
        d.setFullYear(d.getFullYear() + anos);
        return d;
      }
      return valor;
    }

    // Mescla a resposta do período comparado (YoY) na resposta principal,
    // produzindo os mesmos campos _ant/_variacao que o backend gera no
    // modo "comparativo" — mantendo a UI intacta.
    function mesclarComparativoYoy(resMain, resSec) {
      if (!resMain || !resSec || !resSec.dados) return;

      var mapaSec = {};
      resSec.dados.forEach(function(it) { mapaSec[normalizarTexto(it.label)] = it; });

      function pctVar(atual, anterior) {
        return anterior > 0 ? ((atual - anterior) / anterior) * 100 : null;
      }

      if (!resMain.modoTodos) {
        resMain.dados.forEach(function(item) {
          var sec = mapaSec[normalizarTexto(item.label)];
          if (!sec) return;
          item.valorAnteriorRaw = sec.valorRaw;
          item.valorAnteriorFormatado = resMain.isPercentual
            ? fmtPctTotal(sec.valorRaw)
            : (resMain.isMoeda ? fmtMoedaTotal(sec.valorRaw) : fmtIntTotal(sec.valorRaw));
          item.variacao = pctVar(item.valorRaw, sec.valorRaw);
        });
      } else {
        var cfgMap = ApiService.getConfigIndicadores();
        var chaves = Object.keys(cfgMap).concat(['taxa_glosa']);
        resMain.dados.forEach(function(item) {
          var sec = mapaSec[normalizarTexto(item.label)];
          if (!sec) return;
          chaves.forEach(function(k) {
            var ant = sec[k];
            item[k + '_ant'] = ant;
            item[k + '_var'] = cfgMap[k] && cfgMap[k].isPercentual && item[k] != null && ant != null
              ? pctVar(item[k], ant)
              : pctVar(item[k] || 0, ant);
          });
        });
      }
    }

    // ----------------------------------------------------------------------
    // ORDENAÇÃO DE 3 ESTADOS NOS TÍTULOS DA TABELA.
    // Com Top-N ativo, ordenar por uma coluna traz os VERDADEIROS extremos
    // da base completa (ex.: os 5 menores % glosado entre todos os itens),
    // e não apenas reordena o recorte que já estava exibido.
    // ----------------------------------------------------------------------
    $scope.ordenarTabela = function(campo) {
      if (!$scope.respostaBackend || !$scope.respostaBackend.dados) return;

      if ($scope.colunaOrdenada !== campo) {
        $scope.colunaOrdenada = campo;
        $scope.direcaoOrdenacao = 'desc';
      } else {
        if ($scope.direcaoOrdenacao === 'desc') {
          $scope.direcaoOrdenacao = 'asc';
        } else if ($scope.direcaoOrdenacao === 'asc') {
          $scope.colunaOrdenada = null;
          $scope.direcaoOrdenacao = null;
        }
      }

      reconstruirExibicao();
    };

    $scope.getIconeOrdenacao = function(campo) {
      if ($scope.colunaOrdenada !== campo) return '';
      if ($scope.direcaoOrdenacao === 'desc') return ' ↓';
      if ($scope.direcaoOrdenacao === 'asc') return ' ↑';
      return '';
    };

    // ----------------------------------------------------------------------
    // WATCHERS E CARREGAMENTO DE DADOS
    // ----------------------------------------------------------------------
    $scope.$watchGroup([
      'config.dimensao', 'config.indicador', 
      'filtrosTop.tipoPeriodo', 'filtrosTop.dataDia', 'filtrosTop.dataMes', 'filtrosTop.dataAno',
      'filtrosTop.modoVisao', 'filtrosTop.limite'
    ], function() {
      if ($scope.config.dimensao && $scope.config.indicador) {
        atualizarRotulosPeriodo();
        solicitarDados();
      }
    });

    // A evolução temporal depende do indicador e do modo comparativo
    $scope.$watchGroup([
      'config.indicador', 'filtrosTop.modoVisao', 'tendenciaAno.valor'
    ], function() {
      if ($scope.config.indicador) $scope.carregarTendencia();
    });

    function obterValorDataEfetiva() {
      if ($scope.filtrosTop.tipoPeriodo === 'dia') return $scope.filtrosTop.dataDia;
      if ($scope.filtrosTop.tipoPeriodo === 'mes') return $scope.filtrosTop.dataMes;
      if ($scope.filtrosTop.tipoPeriodo === 'ano') return $scope.filtrosTop.dataAno;
      return null;
    }

    // Token anti-race: apenas a resposta da requisição mais recente é aplicada
    var tokenRequisicao = 0;

    function solicitarDados() {
      if (debounceTimer) $timeout.cancel(debounceTimer);
      $scope.carregando = true;
      $scope.erroCarregamento = false;

      debounceTimer = $timeout(function() {
        var token = ++tokenRequisicao;

        var payload = {
          dimensao: $scope.config.dimensao,
          indicador: $scope.config.indicador,
          tipoPeriodo: $scope.filtrosTop.tipoPeriodo,
          periodoValor: obterValorDataEfetiva(),
          modo: $scope.filtrosTop.modoVisao === 'yoy' ? 'normal' : $scope.filtrosTop.modoVisao,
          ordem: $scope.filtrosTop.ordem,
          limite: $scope.filtrosTop.limite
        };

        var promessaPrincipal;

        if ($scope.filtrosTop.modoVisao === 'yoy') {
          // YoY sem suporte do backend: busca o período atual e o mesmo
          // período do ano anterior (limite 'todos' p/ casar por rótulo),
          // e mescla client-side no formato _ant/_variacao padrão.
          var payloadYoy = angular.copy(payload);
          payloadYoy.periodoValor = deslocarPeriodoAnos(payload.tipoPeriodo, payload.periodoValor, -1);
          payloadYoy.limite = 'todos';

          promessaPrincipal = ApiService.obterDadosDashboard(payload).then(function(resMain) {
            return ApiService.obterDadosDashboard(payloadYoy).then(function(resSec) {
              mesclarComparativoYoy(resMain, resSec);
              return resMain;
            }).catch(function() { return resMain; });
          });
        } else {
          promessaPrincipal = ApiService.obterDadosDashboard(payload);
        }

        promessaPrincipal.then(function(res) {
          if (token !== tokenRequisicao) return;

          $scope.respostaBackend = res;
          $scope.totalParticipacao = 0;
          $scope.painelColunasAberto = false;

          if (res && res.dados) {
            // Nova consulta: descarta base completa da consulta anterior
            baseCompletaDados = null;

            // Cópia rasa: os itens são imutáveis após o recebimento
            $scope.dadosOriginais = res.dados.slice();

            $scope.colunaOrdenada = null;
            $scope.direcaoOrdenacao = null;
            $scope.filtrosBusca.tabela = "";

            marcarAnomalias(res.dados, res.modoTodos);
            $scope.calcularMaioresVariacoes();

            recalcularAgregados(res, null);
          }

          salvarEstado();
          sincronizarHashVisao();
          gravarCacheResposta(payload, res);
          $timeout(function() { if (res && res.dados) renderizarGraficos(res); }, 60);

          // Atualiza o gráfico de evolução sempre que os dados principais mudam
          $timeout(function() { $scope.carregarTendencia(); }, 100);

          // Quando o Top-N corta registros, busca a base completa em
          // segundo plano para KPIs "Totais" e Participação (%) refletirem
          // o todo — não apenas o subconjunto exibido.
          if (precisaConsultaCompleta(res)) {
            var payloadTotais = angular.copy(payload);
            payloadTotais.limite = 'todos';
            ApiService.obterDadosDashboard(payloadTotais).then(function(resFull) {
              if (token !== tokenRequisicao || !resFull || !resFull.dados) return;
              res.totalBase = resFull.totalBase || resFull.dados.length;
              recalcularAgregados(res, resFull.dados);
            }).catch(function() { /* segue com os totais do Top-N */ });
          }
        }).catch(function(erro) {
          if (token !== tokenRequisicao) return;
          console.error('Falha ao obter dados do dashboard:', erro);
          $scope.respostaBackend = null;
          baseCompletaDados = null;
          $scope.erroCarregamento = true;
          $scope.mostrarToast('Erro ao carregar os dados do dashboard.', 'erro');
        }).finally(function() {
          if (token === tokenRequisicao) $scope.carregando = false;
        });
      }, 150);
    }

    // O Top-N cortou registros? Se sim, vale buscar a base completa p/ agregados
    function precisaConsultaCompleta(res) {
      return !!(res && res.dados && res.dados.length &&
        res.totalBase > res.dados.length && $scope.filtrosTop.limite !== 'todos');
    }

    // Recalcula participacao, totais do rodape, conformidade e KPIs.
    // Usa a base completa (quando disponivel) para os valores do periodo atual;
    // os valores _ant continuam vindo da resposta exibida (modo comparativo/YoY).
    var fonteAgregados = null;

    function recalcularAgregados(res, dadosCompletos) {
      fonteAgregados = dadosCompletos || res.dados;
      if (dadosCompletos) baseCompletaDados = dadosCompletos;
      $scope.totalParticipacao = fonteAgregados.reduce(function(acc, it) { return acc + (it.valorRaw || 0); }, 0);
      calcularConformidadeMeta();
      // Quando a base completa chega depois da 1ª pintura, reconstrói a
      // exibição para os extremos reais (Top-N pela ordenação ativa).
      reconstruirExibicao();
    }

    // ======================================================================
    // METAS EXECUTIVAS (SEMÁFORO POR INDICADOR)
    // ======================================================================
    var CHAVE_METAS = 'pempfrg_dashboard_metas_v1';
    var CHAVE_ANOMALIA = 'pempfrg_dashboard_anomalia_v1';
    var CHAVE_VIEWS = 'pempfrg_dashboard_views_v1';
    var CHAVE_CACHE = 'pempfrg_dashboard_cache_v1';

    var METAS_PADRAO = {
      taxa_glosa:    { valor: 5,  tipo: 'max' },
      pct_recebido:  { valor: 90, tipo: 'min' }
    };

    $scope.metas = angular.copy(METAS_PADRAO);
    $scope.painelMetasAberto = false;
    $scope.conformidadeMeta = null;

    (function carregarMetas() {
      try {
        var ms = JSON.parse(localStorage.getItem(CHAVE_METAS) || 'null');
        if (ms) {
          Object.keys(METAS_PADRAO).forEach(function(k) {
            if (ms[k] && typeof ms[k].valor === 'number') $scope.metas[k].valor = ms[k].valor;
            if (ms[k] && typeof ms[k].tipo === 'string') $scope.metas[k].tipo = ms[k].tipo;
          });
        }
      } catch (e) { /* ignora */ }
    })();

    $scope.salvarMetas = function() {
      Object.keys($scope.metas).forEach(function(k) {
        var v = parseFloat($scope.metas[k].valor);
        $scope.metas[k].valor = isNaN(v) ? METAS_PADRAO[k].valor : v;
      });
      try { localStorage.setItem(CHAVE_METAS, JSON.stringify($scope.metas)); } catch (e) { }
      calcularConformidadeMeta();
      if ($scope.respostaBackend) marcarAnomalias($scope.respostaBackend.dados, $scope.respostaBackend.modoTodos);
    };

    $scope.restaurarMetasPadrao = function() {
      Object.keys(METAS_PADRAO).forEach(function(k) { $scope.metas[k] = angular.copy(METAS_PADRAO[k]); });
      $scope.salvarMetas();
      $scope.mostrarToast('Metas restauradas para os valores padrão.', 'sucesso');
    };

    $scope.metaStatus = function(chave) {
      var meta = $scope.metas[chave];
      var nums = ($scope.kpis && $scope.kpis.nums) || {};
      var valor = nums[chave];
      if (!meta || valor == null || isNaN(valor)) return { ok: true };
      return { ok: meta.tipo === 'max' ? valor <= meta.valor : valor >= meta.valor };
    };

    function calcularConformidadeMeta() {
      var res = $scope.respostaBackend;
      if (!res || !res.modoTodos || !res.dados || !res.dados.length) { $scope.conformidadeMeta = null; return; }
      var limite = parseFloat($scope.metas.taxa_glosa.valor) || 0;
      var dentro = res.dados.filter(function(it) { return (it.taxa_glosa || 0) <= limite; }).length;
      $scope.conformidadeMeta = dentro;
    }

    // Classificação da taxa de glosa respeita a meta configurada
    // (baixa ≤ meta · média ≤ 2× meta · alta acima)
    $scope.glosaRateClass = function(item) {
      var pct = item && item.taxa_glosa != null ? item.taxa_glosa : 0;
      var limBaixa = parseFloat($scope.metas.taxa_glosa.valor) || 5;
      if (pct <= limBaixa) return 'badge-glosa-baixa';
      if (pct <= limBaixa * 2) return 'badge-glosa-media';
      return 'badge-glosa-alta';
    };

    // ======================================================================
    // ANOMALIAS — DESTAQUE DE VARIAÇÕES FORTES NA TABELA
    // ======================================================================
    $scope.destacarAnomalias = false;
    $scope.limiarAnomalia = 25;

    (function carregarPrefAnomalia() {
      try {
        var p = JSON.parse(localStorage.getItem(CHAVE_ANOMALIA) || 'null');
        if (p) {
          if (typeof p.on === 'boolean') $scope.destacarAnomalias = p.on;
          if (typeof p.limiar === 'number') $scope.limiarAnomalia = p.limiar;
        }
      } catch (e) { /* ignora */ }
    })();

    $scope.alternarAnomalias = function() {
      $scope.destacarAnomalias = !$scope.destacarAnomalias;
      try { localStorage.setItem(CHAVE_ANOMALIA, JSON.stringify({ on: $scope.destacarAnomalias, limiar: $scope.limiarAnomalia })); } catch (e) { }
    };

    function marcarAnomalias(dados, modoTodos) {
      if (!dados) return;
      var limiar = $scope.limiarAnomalia || 0;
      var emComparativo = $scope.filtrosTop.modoVisao !== 'normal';

      dados.forEach(function(it) { it.__anomalia = false; });

      if (!emComparativo) return;

      if (modoTodos) {
        dados.forEach(function(it) {
          it.__anomalia = $scope.definicaoColunas.some(function(col) {
            var v = it[col.key + '_var'];
            return v != null && Math.abs(v) >= limiar;
          });
        });
      } else {
        dados.forEach(function(it) {
          it.__anomalia = it.variacao != null && Math.abs(it.variacao) >= limiar;
        });
      }
    }

    // ======================================================================
    // PAINEL MAIORES VARIAÇÕES + FOCO NA TABELA
    // ======================================================================
    // Objeto (não primitivo): o select vive sob ng-if e um primitivo seria
    // sombreado no escopo-filho, impedindo o controller de ver a troca.
    $scope.painelVarMetrica = { metrica: 'valor_faturado' };
    $scope.maioresVar = { altas: [], quedas: [] };
    $scope.linhaFocada = null;

    $scope.calcularMaioresVariacoes = function() {
      var res = $scope.respostaBackend;
      var altas = [], quedas = [];

      if (res && res.dados && res.dados.length) {
        var itens = [];

        if (res.modoTodos) {
          var colSel = null;
          $scope.definicaoColunas.forEach(function(c) { if (c.key === $scope.painelVarMetrica.metrica) colSel = c; });

          res.dados.forEach(function(it) {
            var v = it[$scope.painelVarMetrica.metrica + '_var'];
            if (v == null) return;
            itens.push({
              label: it.label,
              var: v,
              valorFmt: it[$scope.painelVarMetrica.metrica + '_fmt'] || '',
              favoravelAlta: colSel ? !colSel.inverterDelta : true
            });
          });
        } else if ($scope.filtrosTop.modoVisao !== 'normal') {
          res.dados.forEach(function(it) {
            if (it.variacao == null) return;
            itens.push({ label: it.label, var: it.variacao, valorFmt: it.valorFormatado || '', favoravelAlta: true });
          });
        }

        itens.sort(function(a, b) { return b.var - a.var; });
        altas = itens.filter(function(x) { return x.var > 0; }).slice(0, 5);
        quedas = itens.filter(function(x) { return x.var < 0; }).reverse().slice(0, 5);
      }

      $scope.maioresVar = { altas: altas, quedas: quedas };
    };

    // Cor do delta no painel: verde quando o movimento é favorável
    // (queda de glosa é bom; queda de faturamento é ruim)
    $scope.classeDeltaVar = function(valor, favoravel) {
      if (valor == null || valor === 0) return 'delta-neutro';
      return favoravel ? 'text-green' : 'text-red';
    };

    $scope.focarLinhaTabela = function(label) {
      if ($scope.filtrosBusca.tabela && normalizarTexto(label).indexOf(normalizarTexto($scope.filtrosBusca.tabela)) === -1) {
        $scope.filtrosBusca.tabela = '';
        $scope.aplicarFiltroTabela();
      }

      $scope.linhaFocada = label;

      $timeout(function() {
        var seletor = 'tr[data-label="' + (window.CSS && CSS.escape ? CSS.escape(label) : cssEscapeFallback(label).replace(/"/g, '\\"')) + '"]';
        var el = document.querySelector(seletor);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);

      $timeout(function() {
        if ($scope.linhaFocada === label) $scope.linhaFocada = null;
      }, 2400);
    };

    // ======================================================================
    // DICIONÁRIO DE INDICADORES
    // ======================================================================
    $scope.painelDicionarioAberto = false;
    $scope.dicionarioIndicadores = {
      qtd_contas:        { nome: 'Qtd. Contas',       descricao: 'Volume de contas (atendimentos) registradas no item no período.' },
      qtd_procedimentos: { nome: 'Qtd. Proc./Exames', descricao: 'Quantidade de procedimentos e exames realizados no item no período.' },
      qtd_matmed:        { nome: 'Qtd. Mat./Med.',    descricao: 'Quantidade de materiais e medicamentos consumidos no item no período.' },
      valor_produzido:   { nome: 'Valor Produzido',   descricao: 'Produção técnica apurada antes do faturamento (R$).' },
      valor_faturado:    { nome: 'Valor Faturado',    descricao: 'Total apresentado às operadoras em guias e faturas no período (R$).' },
      valor_recebido:    { nome: 'Valor Recebido',    descricao: 'Valores efetivamente pagos ou creditados pelas operadoras (R$). Maior é melhor.' },
      valor_glosado:     { nome: 'Valor Glosado',     descricao: 'Valores negados ou deduzidos pelas operadoras sobre o faturado (R$). Menor é melhor.' },
      taxa_glosa:        { nome: '% Glosa',           descricao: '= Glosado ÷ Faturado × 100. Principal termômetro de perda de receita (%). Menor é melhor.' },
      valor_adicional:   { nome: 'Valor Adicional',   descricao: 'Acréscimos obtidos em revisão de conta — itens não faturados etc. (R$).' },
      valor_medico:      { nome: 'Repasse Médico',    descricao: 'Repasse ao corpo clínico sobre o faturamento do item (R$).' }
    };

    // ======================================================================
    // VISÕES SALVAS + LINK COMPARTILHÁVEL (#hash)
    // ======================================================================
    $scope.viewsSalvas = [];
    $scope.menuViewsAberto = false;

    (function carregarViews() {
      try {
        var vs = JSON.parse(localStorage.getItem(CHAVE_VIEWS) || 'null');
        if (Array.isArray(vs)) $scope.viewsSalvas = vs;
      } catch (e) { /* ignora */ }
    })();

    function capturarEstadoVisao() {
      var f = $scope.filtrosTop;
      return {
        dimensao: $scope.config.dimensao,
        indicador: $scope.config.indicador,
        tipoPeriodo: f.tipoPeriodo,
        dataDia: f.dataDia instanceof Date ? formatarDataISO(f.dataDia) : null,
        dataMes: f.dataMes instanceof Date ? formatarMesISO(f.dataMes) : null,
        dataAno: f.dataAno,
        modoVisao: f.modoVisao,
        ordem: f.ordem,
        limite: f.limite
      };
    }

    function aplicarEstadoVisao(est) {
      if (!est) return;
      if (DIMENSOES_VALIDAS.indexOf(est.dimensao) !== -1) $scope.config.dimensao = est.dimensao;
      if (INDICADORES_VALIDOS.indexOf(est.indicador) !== -1) $scope.config.indicador = est.indicador;
      if (['dia', 'mes', 'ano'].indexOf(est.tipoPeriodo) !== -1) $scope.filtrosTop.tipoPeriodo = est.tipoPeriodo;
      if (MODOS_VISAO_VALIDOS.indexOf(est.modoVisao) !== -1) $scope.filtrosTop.modoVisao = est.modoVisao;
      if (['asc', 'desc'].indexOf(est.ordem) !== -1) $scope.filtrosTop.ordem = est.ordem;
      if (est.limite && ['5','10','25','50','todos'].indexOf(String(est.limite)) !== -1) $scope.filtrosTop.limite = String(est.limite);
      if (typeof est.dataAno === 'number' && est.dataAno >= 2000 && est.dataAno <= 2100) $scope.filtrosTop.dataAno = est.dataAno;
      if (typeof est.dataDia === 'string') {
        var p = est.dataDia.split('-');
        if (p.length === 3 && !isNaN(Date.parse(est.dataDia))) $scope.filtrosTop.dataDia = new Date(+p[0], +p[1] - 1, +p[2]);
      }
      if (typeof est.dataMes === 'string') {
        var pm = est.dataMes.split('-');
        if (pm.length === 2) $scope.filtrosTop.dataMes = new Date(+pm[0], +pm[1] - 1, 1);
      }
    }

    function descreverVisaoAtual() {
      var d = ApiService.getNomesDimensao()[$scope.config.dimensao] || $scope.config.dimensao;
      var mv = $scope.filtrosTop.modoVisao === 'normal' ? '' : (' × ' + ($scope.infoPeriodo.rotuloAnterior || ''));
      return d + ' · ' + $scope.infoPeriodo.rotuloAtual + mv;
    }

    $scope.modalViewAberto = false;
    // Objeto (não primitivo): o input vive sob o ng-if do modal.
    $scope.novaView = { nome: '' };

    $scope.salvarViewAtual = function() {
      $scope.novaView.nome = descreverVisaoAtual();
      $scope.menuViewsAberto = false;
      $scope.modalViewAberto = true;
      $timeout(function() {
        var inp = document.getElementById('inputNomeView');
        if (inp) { inp.focus(); inp.select(); }
      }, 50);
    };

    $scope.confirmarSalvarView = function() {
      var nome = ($scope.novaView.nome || '').trim();
      if (!nome) return;
      $scope.viewsSalvas.unshift({ nome: nome.substring(0, 60), desc: descreverVisaoAtual(), estado: capturarEstadoVisao() });
      if ($scope.viewsSalvas.length > 20) $scope.viewsSalvas.pop();
      try { localStorage.setItem(CHAVE_VIEWS, JSON.stringify($scope.viewsSalvas)); } catch (e) { }
      $scope.modalViewAberto = false;
      $scope.mostrarToast('Visão "' + nome + '" salva.', 'sucesso');
    };

    $scope.cancelarSalvarView = function() {
      $scope.modalViewAberto = false;
    };

    $scope.aplicarView = function(v) {
      if (!v || !v.estado) return;
      $scope.fecharMenusFlutuantes();
      aplicarEstadoVisao(v.estado);
      atualizarRotulosPeriodo();
      salvarEstado();
      solicitarDados();
    };

    $scope.excluirView = function(ev, v) {
      ev.stopPropagation();
      var idx = $scope.viewsSalvas.indexOf(v);
      if (idx !== -1) $scope.viewsSalvas.splice(idx, 1);
      try { localStorage.setItem(CHAVE_VIEWS, JSON.stringify($scope.viewsSalvas)); } catch (e) { }
    };

    function construirHashVisao() {
      var e = capturarEstadoVisao();
      var p = [];
      p.push('d=' + encodeURIComponent(e.dimensao));
      p.push('i=' + encodeURIComponent(e.indicador));
      p.push('tp=' + e.tipoPeriodo);
      if (e.dataDia) p.push('dd=' + e.dataDia);
      if (e.dataMes) p.push('dm=' + e.dataMes);
      if (e.tipoPeriodo === 'ano') p.push('da=' + e.dataAno);
      p.push('mv=' + e.modoVisao);
      p.push('o=' + e.ordem);
      p.push('l=' + e.limite);
      return '#' + p.join('&');
    }

    function sincronizarHashVisao() {
      try { window.history.replaceState(null, '', construirHashVisao()); } catch (e) { /* ignora */ }
    }

    function parseHashEstado() {
      if (!location.hash || location.hash.length < 2) return false;
      try {
        var params = new URLSearchParams(location.hash.substring(1));
        if (!params.get('d')) return false;
        aplicarEstadoVisao({
          dimensao: decodeURIComponent(params.get('d') || ''),
          indicador: decodeURIComponent(params.get('i') || ''),
          tipoPeriodo: params.get('tp'),
          dataDia: params.get('dd'),
          dataMes: params.get('dm'),
          dataAno: params.get('da') ? parseInt(params.get('da'), 10) : null,
          modoVisao: params.get('mv'),
          ordem: params.get('o'),
          limite: params.get('l')
        });
        return true;
      } catch (e) { return false; }
    }

    $scope.compartilharVisao = function() {
      sincronizarHashVisao();
      var url = location.href;
      function fallbackCopia() {
        try {
          var ta = document.createElement('textarea');
          ta.value = url;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          var ok = document.execCommand('copy');
          document.body.removeChild(ta);
          $scope.$apply(function() {
            $scope.mostrarToast(ok ? 'Link da visão copiado!' : 'Não foi possível copiar o link.', ok ? 'sucesso' : 'erro');
          });
        } catch (e) { }
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function() {
          safeApply(function() { $scope.mostrarToast('Link da visão copiado! Quem abrir verá exatamente estes filtros.', 'sucesso'); });
        }, fallbackCopia);
      } else {
        fallbackCopia();
      }
    };
    // ----------------------------------------------------------------------
    // CÁLCULO DE KPIS EXECUTIVOS HOSPITALARES & SUMÁRIO COMPARATIVO
    // ----------------------------------------------------------------------
    function calcularKPIs(res) {
      if (!res.dados || res.dados.length === 0) {
        $scope.kpis = {};
        return;
      }

      if (res.modoTodos) {
        // Fonte de agregação: base completa quando o Top-N cortou registros
        var fonteKpis = fonteAgregados || res.dados;

        let totalContas = fonteKpis.reduce((acc, item) => acc + (item.qtd_contas || 0), 0);
        let totalProcedimentos = fonteKpis.reduce((acc, item) => acc + (item.qtd_procedimentos || 0), 0);
        let totalMatmed = fonteKpis.reduce((acc, item) => acc + (item.qtd_matmed || 0), 0);

        let totalProduzido = fonteKpis.reduce((acc, item) => acc + (item.valor_produzido || 0), 0);
        let totalFaturado = fonteKpis.reduce((acc, item) => acc + (item.valor_faturado || 0), 0);
        let totalRecebido = fonteKpis.reduce((acc, item) => acc + (item.valor_recebido || 0), 0);
        let totalGlosado = fonteKpis.reduce((acc, item) => acc + (item.valor_glosado || 0), 0);
        let totalAdicional = fonteKpis.reduce((acc, item) => acc + (item.valor_adicional || 0), 0);
        let totalMedico = fonteKpis.reduce((acc, item) => acc + (item.valor_medico || 0), 0);

        let taxaGlosa = totalFaturado > 0 ? (totalGlosado / totalFaturado) * 100 : 0;
        let taxaRecebimento = totalFaturado > 0 ? (totalRecebido / totalFaturado) * 100 : 0;
        let taxaRepasse = totalFaturado > 0 ? (totalMedico / totalFaturado) * 100 : 0;
        let ticketMedio = totalContas > 0 ? totalFaturado / totalContas : 0;

        // Comparativo com período anterior — soma dos valores _ant gerados pela fonte de dados
        let somarCampo = function(campo) {
          return res.dados.reduce(function(acc, item) { return acc + (item[campo] || 0); }, 0);
        };

        let contasAnt = somarCampo('qtd_contas_ant');
        let fatAnt = somarCampo('valor_faturado_ant');
        let recAnt = somarCampo('valor_recebido_ant');
        let gloAnt = somarCampo('valor_glosado_ant');
        let medicoAnt = somarCampo('valor_medico_ant');

        function variacaoPct(atual, anterior) {
          return anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0;
        }

        let varContas = variacaoPct(totalContas, contasAnt);
        let varFat = variacaoPct(totalFaturado, fatAnt);
        let varRec = variacaoPct(totalRecebido, recAnt);
        let varGlo = variacaoPct(totalGlosado, gloAnt);
        let varMedico = variacaoPct(totalMedico, medicoAnt);

        $scope.kpis = {
          totalContasFormatado: fmtIntTotal(totalContas),
          contasAnteriorFormatado: fmtIntTotal(contasAnt),
          varContas: varContas,

          procedimentosFormatado: fmtIntTotal(totalProcedimentos),
          matmedFormatado: fmtIntTotal(totalMatmed),

          produzidoFormatado: totalProduzido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),

          faturadoFormatado: totalFaturado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          faturadoAnteriorFormatado: fatAnt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          varFaturado: varFat,

          recebidoFormatado: totalRecebido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          recebidoAnteriorFormatado: recAnt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          varRecebido: varRec,

          glosadoFormatado: totalGlosado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          glosadoAnteriorFormatado: gloAnt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          varGlosado: varGlo,

          adicionalFormatado: totalAdicional.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),

          medicoFormatado: totalMedico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          medicoAnteriorFormatado: medicoAnt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          varMedico: varMedico,

          taxaGlosa: taxaGlosa.toFixed(1),
          taxaGlosaNum: taxaGlosa,
          taxaRecebimento: taxaRecebimento.toFixed(1),
          taxaRepasse: taxaRepasse.toFixed(1),

          ticketMedioFormatado: ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),

          nums: {
            taxa_glosa: taxaGlosa,
            pct_recebido: taxaRecebimento
          }
        };

      } else {
        var fonteIndividual = fonteAgregados || res.dados;
        let soma = fonteIndividual.reduce((acc, item) => acc + (item.valorRaw || 0), 0);
        let media = soma / fonteIndividual.length;

        // Líder real = maior valorRaw da base — não o 1º da ordenação
        // vigente da tabela (com "menores primeiro" mostrava o menor item).
        var lider = null;
        fonteIndividual.forEach(function(it) {
          if (!lider || (it.valorRaw || 0) > (lider.valorRaw || 0)) lider = it;
        });
        let pctLider = (lider && soma > 0) ? ((lider.valorRaw || 0) / soma) * 100 : 0;

        $scope.kpis = {
          liderLabel: lider ? lider.label : '-',
          liderValorFormatado: lider ? (lider.valorFormatado || '-') : '-',
          percentualLider: pctLider.toFixed(1)
        };

        if (res.isPercentual) {
          $scope.kpis.somaTotalFormatted = media.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + '%';
          $scope.kpis.mediaFormatted = media.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + '%';
        } else if (res.isMoeda) {
          $scope.kpis.somaTotalFormatted = soma.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          $scope.kpis.mediaFormatted = media.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        } else {
          $scope.kpis.somaTotalFormatted = Math.round(soma).toLocaleString('pt-BR');
          $scope.kpis.mediaFormatted = Math.round(media).toLocaleString('pt-BR');
        }

        if ($scope.filtrosTop.modoVisao === 'comparativo') {
          let somaAnterior = res.dados.reduce((acc, item) => acc + (item.valorAnteriorRaw || 0), 0);
          let varGlobal = somaAnterior > 0 ? ((soma - somaAnterior) / somaAnterior) * 100 : 0;
          $scope.kpis.variacaoGlobal = varGlobal;
          
          if (res.isPercentual) {
            let mediaAnt = somaAnterior / res.dados.length;
            $scope.kpis.somaAnteriorFormatted = mediaAnt.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + '%';
          } else if (res.isMoeda) {
            $scope.kpis.somaAnteriorFormatted = somaAnterior.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          } else {
            $scope.kpis.somaAnteriorFormatted = Math.round(somaAnterior).toLocaleString('pt-BR');
          }
        }
      }
    }

    // ======================================================================
    // CACHE STALE-WHILE-REVALIDATE (ABERTURA INSTANTÂNEA)
    // ======================================================================
    function assinaturaDePayload(p) {
      var dv = p.periodoValor;
      var s = '';
      if (dv instanceof Date) s = (p.tipoPeriodo === 'mes' ? formatarMesISO(dv) : formatarDataISO(dv));
      else if (typeof dv === 'number') s = String(dv);
      return [p.dimensao, p.indicador, p.tipoPeriodo, s, p.modo, p.ordem, p.limite].join('|');
    }

    function gravarCacheResposta(payload, res) {
      try {
        localStorage.setItem(CHAVE_CACHE, JSON.stringify({
          sig: assinaturaDePayload(payload),
          quando: new Date().toISOString(),
          res: res
        }));
      } catch (e) { /* cota excedida: segue sem cache */ }
    }

    function lerCacheResposta(payload) {
      try {
        var c = JSON.parse(localStorage.getItem(CHAVE_CACHE) || 'null');
        return (c && c.sig === assinaturaDePayload(payload)) ? c : null;
      } catch (e) { return null; }
    }

    // Aplica silenciosamente a última resposta compatível com os filtros
    // atuais, para o dashboard "pintar" instantaneamente enquanto a
    // requisição real chega por cima.
    function aplicarCacheInicial() {
      var payload = {
        dimensao: $scope.config.dimensao,
        indicador: $scope.config.indicador,
        tipoPeriodo: $scope.filtrosTop.tipoPeriodo,
        periodoValor: obterValorDataEfetiva(),
        modo: $scope.filtrosTop.modoVisao === 'yoy' ? 'normal' : $scope.filtrosTop.modoVisao,
        ordem: $scope.filtrosTop.ordem,
        limite: $scope.filtrosTop.limite
      };

      var c = lerCacheResposta(payload);
      if (!c || !c.res || !c.res.dados) return;

      atualizarRotulosPeriodo();
      var res = c.res;
      $scope.respostaBackend = res;
      baseCompletaDados = null;
      $scope.dadosOriginais = res.dados.slice();
      marcarAnomalias(res.dados, res.modoTodos);
      $scope.calcularMaioresVariacoes();
      recalcularAgregados(res, null);

      try {
        var dt = new Date(c.quando);
        $scope.mostrarToast('Exibindo consulta salva de ' + dt.toLocaleString('pt-BR') + '. Atualizando...', 'info');
      } catch (e) { }
    }

    // ======================================================================
    // EVOLUÇÃO TEMPORAL — TENDÊNCIA MENSAL (12 MESES)
    // ======================================================================
    let chart3 = null;
    var tokenTendencia = 0;
    var cacheTendAtual = null;
    var cacheTendAnterior = null;

    $scope.listaAnosTendencia = $scope.listaAnos;
    // Objeto (não primitivo): o select vive sob ng-if e um primitivo seria
    // sombreado no escopo-filho, prendendo o ano no valor inicial.
    $scope.tendenciaAno = { valor: anoAtual };
    $scope.filtroSerieTendencia = 'todos';
    $scope.tendenciaCarregando = false;
    $scope.tendenciaTemDados = false;

    $scope.definirSerieTendencia = function(filtro) {
      $scope.filtroSerieTendencia = filtro;
      renderizarTendencia();
    };

    function payloadTendencia(ano) {
      return {
        dimensao: 'mes',
        indicador: $scope.config.indicador,
        tipoPeriodo: 'ano',
        periodoValor: ano,
        modo: 'normal',
        ordem: 'asc',
        limite: 'todos'
      };
    }

    $scope.carregarTendencia = function() {

      var token = ++tokenTendencia;

      $scope.tendenciaCarregando = true;

      var querAnterior = $scope.filtrosTop.modoVisao !== 'normal';
      var promessas = [ApiService.obterDadosDashboard(payloadTendencia($scope.tendenciaAno.valor))];
      if (querAnterior) promessas.push(ApiService.obterDadosDashboard(payloadTendencia($scope.tendenciaAno.valor - 1)));

      $q.all(promessas).then(function(resultados) {
        if (token !== tokenTendencia) return;
        cacheTendAtual = resultados[0];
        cacheTendAnterior = querAnterior ? resultados[1] : null;
        $scope.tendenciaTemDados = !!(cacheTendAtual && cacheTendAtual.dados && cacheTendAtual.dados.length);
        $scope.tendenciaCarregando = false;
        if ($scope.tendenciaTemDados) $timeout(renderizarTendencia, 40);
      }).catch(function() {
        if (token !== tokenTendencia) return;
        $scope.tendenciaCarregando = false;
        $scope.tendenciaTemDados = false;
      });
    };

    function renderizarTendencia() {
      if (chart3) { chart3.destroy(); chart3 = null; }
      if (!cacheTendAtual || !cacheTendAtual.dados) return;

      var cg = coresGrafico();
      var cfgMap = ApiService.getConfigIndicadores();

      // Ordena os dados por ordem calendário (Jan-Dez) antes de plotar
      var ordemMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      function indiceMes(label) {
        var m = label.substring(0, 3);
        var idx = ordemMeses.indexOf(m);
        return idx >= 0 ? idx : 999;
      }
      var dadosAtualOrdenados = cacheTendAtual.dados.slice().sort(function(a, b) {
        return indiceMes(a.label) - indiceMes(b.label);
      });
      var dadosAntOrdenados = cacheTendAnterior && cacheTendAnterior.dados
        ? cacheTendAnterior.dados.slice().sort(function(a, b) {
            return indiceMes(a.label) - indiceMes(b.label);
          })
        : null;

      var labels = dadosAtualOrdenados.map(function(d) { return d.label.substring(0, 3); });
      var datasets = [];

      function montarSerie(cfgKey, cor, rotulo, fonte, tracejada) {
        var ind = cfgMap[cfgKey];
        var isMoeda = ind ? ind.isMoeda : false;
        return {
          label: rotulo,
          data: fonte.map(function(d) { return d[cfgKey]; }),
          borderColor: cor,
          backgroundColor: 'transparent',
          borderDash: tracejada ? [6, 4] : undefined,
          borderWidth: 2,
          pointRadius: 2.5,
          pointHoverRadius: 4.5,
          tension: 0.35,
          fill: false,
          isMoeda: isMoeda,
          yAxisID: isMoeda ? 'yFinanc' : 'yVol'
        };
      }

      var sufixoAnt = cacheTendAnterior ? (' · ' + ($scope.tendenciaAno.valor - 1)) : '';

      if (cacheTendAtual.modoTodos) {
        var chaves;
        if ($scope.filtroSerieTendencia === 'financeiro') chaves = Object.keys(cfgMap).filter(k => cfgMap[k].isMoeda);
        else if ($scope.filtroSerieTendencia === 'quantidades') chaves = Object.keys(cfgMap).filter(k => !cfgMap[k].isMoeda);
        else if ($scope.filtroSerieTendencia === 'faturamento_vs_glosa') chaves = ['valor_faturado', 'valor_recebido', 'valor_glosado'];
        else chaves = Object.keys(cfgMap);

        chaves.forEach(function(key) {
          var ind = cfgMap[key];
          datasets.push(montarSerie(key, corDeIndicador(key, ind.color), ind.nome, dadosAtualOrdenados, false));
          if (dadosAntOrdenados) {
            datasets.push(montarSerie(key, cg.barraAnterior, ind.nome + sufixoAnt, dadosAntOrdenados, true));
          }
        });
      } else {
        var chaveUnica = $scope.config.indicador;
        var corUnica = corDeIndicador(chaveUnica, cacheTendAtual.color || '#2563eb');
        datasets.push({
          label: cacheTendAtual.nomeIndicador + (' · ' + $scope.tendenciaAno.valor),
          data: dadosAtualOrdenados.map(function(d) { return d.valorRaw; }),
          borderColor: corUnica,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.35,
          fill: false,
          isMoeda: cacheTendAtual.isMoeda,
          yAxisID: cacheTendAtual.isMoeda ? 'yFinanc' : 'yVol'
        });

        if (dadosAntOrdenados) {
          datasets.push({
            label: (cacheTendAnterior.nomeIndicador || '') + sufixoAnt,
            data: dadosAntOrdenados.map(function(d) { return d.valorRaw; }),
            borderColor: cg.barraAnterior,
            backgroundColor: 'transparent',
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.35,
            fill: false,
            isMoeda: cacheTendAnterior.isMoeda,
            yAxisID: cacheTendAnterior.isMoeda ? 'yFinanc' : 'yVol'
          });
        }
      }

      var temFinanc = datasets.some(ds => ds.yAxisID === 'yFinanc');
      var temVol = datasets.some(ds => ds.yAxisID === 'yVol');

      var scales = {};
      scales.x = { grid: { color: cg.grid }, ticks: { font: { size: 10 }, color: cg.tick } };
      if (temFinanc) {
        scales.yFinanc = {
          type: 'linear', position: 'left',
          grid: { color: cg.grid },
          ticks: { font: { size: 10 }, color: cg.tick, callback: v => fmtValorCurto(v, true, false) }
        };
      }
      if (temVol) {
        scales.yVol = {
          type: 'linear', position: temFinanc ? 'right' : 'left',
          grid: { drawOnChartArea: !temFinanc },
          ticks: { font: { size: 10 }, color: cg.tick, callback: v => fmtValorCurto(v, false, false) }
        };
      }

      const canvasT = document.getElementById('chartTendencia');
      if (!canvasT) return;

      chart3 = new Chart(canvasT.getContext('2d'), {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          animation: { duration: 450 },
          plugins: {
            legend: {
              position: 'top',
              labels: { font: { size: 10.5, weight: '600' }, boxWidth: 14, boxHeight: 2, padding: 10, color: cg.legenda, usePointStyle: false }
            },
            tooltip: {
              padding: 10,
              backgroundColor: cg.tooltipBg,
              titleFont: { size: 12, weight: '700' },
              bodyFont: { size: 11.5 },
              cornerRadius: 6,
              callbacks: {
                label: function(context) {
                  var ds = context.dataset;
                  var val = context.raw || 0;
                  var fmt = ds.isPercentual ? fmtValorCurto(val, false, true) : (ds.isMoeda ? fmtValorCurto(val, true, false) : Math.round(val).toLocaleString('pt-BR'));
                  return ' ' + ds.label + ': ' + fmt;
                }
              }
            }
          },
          scales: scales
        }
      });
    }

    // ======================================================================
    // DRILL-DOWN DA TABELA — DETALHE DO ITEM + EVOLUÇÃO MENSAL
    // ======================================================================
    var chartDrill = null;
    var tokenDrill = 0;
    $scope.modalDrillAberto = false;
    $scope.drillItem = null;
    $scope.drillSerie = null;
    $scope.drillCarregando = false;

    $scope.fecharDrillDown = function() {
      $scope.modalDrillAberto = false;
      if (chartDrill) { chartDrill.destroy(); chartDrill = null; }
    };

    $scope.abrirDrillDown = function(item) {
      if (!item || !item.label) return;
      $scope.fecharMenusFlutuantes();
      $scope.drillItem = item;
      $scope.drillSerie = null;
      $scope.modalDrillAberto = true;
      $scope.drillCarregando = true;

      var token = ++tokenDrill;
      ApiService.obterDadosDashboard({
        dimensao: 'mes',
        indicador: $scope.config.indicador,
        tipoPeriodo: 'ano',
        periodoValor: $scope.tendenciaAno.valor,
        modo: 'normal',
        ordem: 'asc',
        limite: 'todos',
        rotulo: item.label
      }).then(function(res) {
        if (token !== tokenDrill || !$scope.modalDrillAberto) return;
        $scope.drillSerie = res && res.dados && res.dados.length ? res : null;
        if ($scope.drillSerie) $timeout(renderizarChartDrill, 40);
      }).catch(function() {
        if (token !== tokenDrill) return;
        $scope.drillSerie = null;
      }).finally(function() {
        if (token === tokenDrill) $scope.drillCarregando = false;
      });
    };

    function renderizarChartDrill() {
      if (chartDrill) { chartDrill.destroy(); chartDrill = null; }
      if (!$scope.drillSerie || !$scope.drillSerie.dados) return;

      var cg = coresGrafico();
      var cfgMap = ApiService.getConfigIndicadores();
      var fonte = $scope.drillSerie.dados;
      var labels = fonte.map(function(d) { return d.label; });
      var datasets = [];

      if ($scope.drillSerie.modoTodos) {
        ['valor_faturado', 'valor_recebido', 'valor_glosado'].forEach(function(key) {
          var ind = cfgMap[key];
          datasets.push({
            label: ind.nome,
            data: fonte.map(function(d) { return d[key]; }),
            borderColor: corDeIndicador(key, ind.color),
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 2.5,
            tension: 0.35,
            fill: false
          });
        });
      } else {
        datasets.push({
          label: $scope.drillSerie.nomeIndicador || $scope.respostaBackend.nomeIndicador,
          data: fonte.map(function(d) { return d.valorRaw; }),
          borderColor: corDeIndicador($scope.config.indicador, $scope.drillSerie.color || '#2563eb'),
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: 3,
          tension: 0.35,
          fill: false
        });
      }

      var canvasD = document.getElementById('chartDrill');
      if (!canvasD) return;

      chartDrill = new Chart(canvasD.getContext('2d'), {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          animation: { duration: 350 },
          plugins: {
            legend: {
              position: 'top',
              labels: { font: { size: 10.5, weight: '600' }, boxWidth: 14, boxHeight: 2, padding: 10, color: cg.legenda }
            },
            tooltip: {
              padding: 10,
              backgroundColor: cg.tooltipBg,
              titleFont: { size: 12, weight: '700' },
              bodyFont: { size: 11.5 },
              cornerRadius: 6,
              callbacks: {
                label: function(context) {
                  var ds = context.dataset;
                  var val = context.raw || 0;
                  var isPct = ds.label.indexOf('%') === 0;
                  var isMoeda = !isPct;
                  return ' ' + ds.label + ': ' + fmtValorCurto(val, isMoeda, isPct);
                }
              }
            }
          },
          scales: {
            x: { grid: { color: cg.grid }, ticks: { font: { size: 10 }, color: cg.tick } },
            y: {
              grid: { color: cg.grid },
              ticks: {
                font: { size: 10 },
                color: cg.tick,
                callback: function(v) {
                  var isPct = !$scope.drillSerie.modoTodos && $scope.respostaBackend && $scope.respostaBackend.isPercentual;
                  if (isPct) return v + '%';
                  var isMoeda = $scope.drillSerie.modoTodos
                    ? true
                    : !!($scope.respostaBackend && $scope.respostaBackend.isMoeda);
                  return fmtValorCurto(v, isMoeda, false);
                }
              }
            }
          }
        }
      });
    }

    $scope.calcularAlturaContainer = function(qtdItens, modoTodos, tipoGrafico) {
      if (tipoGrafico === 'doughnut') return '360px';
      if (tipoGrafico === 'bar') return '390px';
      var heightPorBarra = modoTodos ? 65 : 34;
      var calculo = qtdItens * heightPorBarra;
      return calculo < 380 ? '380px' : calculo + 'px';
    };

    // ----------------------------------------------------------------------
    // EXPORTAÇÃO CSV / EXCEL E IMPRESSÃO
    // ----------------------------------------------------------------------
    function escaparCsv(txt) {
      return '"' + String(txt == null ? '' : txt).replace(/"/g, '""') + '"';
    }

    function numCsv(v) {
      return (Number(v) || 0).toFixed(2).replace('.', ',');
    }

    function montarConteudoCsv(res) {
      let csvRows = [];

      if (res.modoTodos) {
        csvRows.push([
          res.nomeDimensao,
          'Qtd_Contas', 'Qtd_Proc_Exames', 'Qtd_MatMed',
          'Valor_Produzido_R$', 'Valor_Faturado_R$', 'Valor_Recebido_R$',
          'Valor_Glosado_R$', 'Taxa_Glosa', 'Valor_Adicional_R$', 'Valor_Repasse_Medico_R$'
        ].join(';'));

        res.dados.forEach(function(d) {
          csvRows.push([
            escaparCsv(d.label),
            numCsv(d.qtd_contas),
            numCsv(d.qtd_procedimentos),
            numCsv(d.qtd_matmed),
            numCsv(d.valor_produzido),
            numCsv(d.valor_faturado),
            numCsv(d.valor_recebido),
            numCsv(d.valor_glosado),
            numCsv(d.taxa_glosa),
            numCsv(d.valor_adicional),
            numCsv(d.valor_medico)
          ].join(';'));
        });

      } else {
        let headers = [res.nomeDimensao, res.nomeIndicador];
        if ($scope.filtrosTop.modoVisao === 'comparativo') {
          headers.push('Periodo_Anterior', 'Variacao_Pct');
        }
        csvRows.push(headers.map(escaparCsv).join(';'));

        res.dados.forEach(function(d) {
          let row = [escaparCsv(d.label), numCsv(d.valorRaw)];
          if ($scope.filtrosTop.modoVisao === 'comparativo') {
            row.push(numCsv(d.valorAnteriorRaw || 0));
            row.push(numCsv(d.variacao || 0));
          }
          csvRows.push(row.join(';'));
        });
      }

      return '\uFEFF' + csvRows.join('\r\n');
    }

    function baixarCsv(conteudo, sufixoArquivo) {
      let blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
      let url = URL.createObjectURL(blob);
      let link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Tasy_Pempfrg_${$scope.config.dimensao}${sufixoArquivo}_${new Date().toISOString().substring(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    }

    $scope.exportarCSV = function() {
      if (!$scope.respostaBackend || !$scope.respostaBackend.dados) {
        $scope.mostrarToast('Nenhum dado disponível para exportação.', 'erro');
        return;
      }

      baixarCsv(montarConteudoCsv($scope.respostaBackend), '');
      $scope.mostrarToast('Planilha CSV gerada com sucesso!', 'sucesso');
    };

    $scope.exportarCSVCompleto = function() {
      if (!$scope.respostaBackend) {
        $scope.mostrarToast('Nenhum dado disponível para exportação.', 'erro');
        return;
      }

      $scope.carregando = true;

      ApiService.obterDadosDashboard({
        dimensao: $scope.config.dimensao,
        indicador: $scope.config.indicador,
        tipoPeriodo: $scope.filtrosTop.tipoPeriodo,
        periodoValor: obterValorDataEfetiva(),
        // Contrato aceita apenas "normal"|"comparativo"; YoY é resolvido
        // client-side e aqui é enviado como "normal".
        modo: $scope.filtrosTop.modoVisao === 'yoy' ? 'normal' : $scope.filtrosTop.modoVisao,
        ordem: $scope.filtrosTop.ordem,
        limite: 'todos'
      }).then(function(res) {
        baixarCsv(montarConteudoCsv(res), '_completo');
        $scope.mostrarToast('Planilha completa gerada (' + res.totalBase + ' registros).', 'sucesso');
      }).catch(function() {
        $scope.mostrarToast('Erro ao gerar a exportação completa.', 'erro');
      }).finally(function() {
        $scope.carregando = false;
      });
    };

    // EXPORTAÇÃO EXCEL (.xls VIA TABELA HTML — SEM DEPENDÊNCIAS EXTERNAS)
    $scope.exportarExcel = function() {
      if (!$scope.respostaBackend || !$scope.respostaBackend.dados || $scope.dadosFiltradosTabela.length === 0) {
        $scope.mostrarToast('Nenhum dado disponível para exportação.', 'erro');
        return;
      }

      let res = $scope.respostaBackend;
      let lista = $scope.dadosFiltradosTabela;
      let esc = function(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };

      let html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Dados</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>';
      html += `<h3>TASY Analytics — Produção / Faturamento / MatMed (${esc(res.nomeDimensao)}) (${esc($scope.infoPeriodo.rotuloAtual)})</h3>`;
      html += '<table border="1"><thead><tr style="background-color:#0f4c81;color:#ffffff;font-weight:bold;">';

      if (res.modoTodos) {
        html += `<th>${esc(res.nomeDimensao)}</th>`;
        ['Qtd. Contas','Qtd. Proc./Exames','Qtd. Mat./Med.','Val. Produzido (R$)','Val. Faturado (R$)','Val. Recebido (R$)','Val. Glosado (R$)','% Glosa','Val. Adicional (R$)','Repasse Médico (R$)'].forEach(function(h) {
          html += `<th>${h}</th>`;
        });
        html += '</tr></thead><tbody>';
        lista.forEach(function(d) {
          html += `<tr><td>${esc(d.label)}</td>` +
            `<td>${(d.qtd_contas || 0).toFixed(2).replace('.', ',')}</td>` +
            `<td>${(d.qtd_procedimentos || 0).toFixed(2).replace('.', ',')}</td>` +
            `<td>${(d.qtd_matmed || 0).toFixed(2).replace('.', ',')}</td>` +
            `<td>${(d.valor_produzido || 0).toFixed(2).replace('.', ',')}</td>` +
            `<td>${(d.valor_faturado || 0).toFixed(2).replace('.', ',')}</td>` +
            `<td>${(d.valor_recebido || 0).toFixed(2).replace('.', ',')}</td>` +
            `<td>${(d.valor_glosado || 0).toFixed(2).replace('.', ',')}</td>` +
            `<td>${(d.taxa_glosa || 0).toFixed(2).replace('.', ',')}</td>` +
            `<td>${(d.valor_adicional || 0).toFixed(2).replace('.', ',')}</td>` +
            `<td>${(d.valor_medico || 0).toFixed(2).replace('.', ',')}</td></tr>`;
        });
      } else {
        html += `<th>${esc(res.nomeDimensao)}</th><th>${esc(res.nomeIndicador)}</th>`;
        if ($scope.filtrosTop.modoVisao === 'comparativo') html += '<th>Período Anterior</th><th>Variação (%)</th>';
        html += '</tr></thead><tbody>';
        lista.forEach(function(d) {
          html += `<tr><td>${esc(d.label)}</td><td>${(d.valorRaw || 0).toFixed(2).replace('.', ',')}</td>`;
          if ($scope.filtrosTop.modoVisao === 'comparativo') {
            html += `<td>${(d.valorAnteriorRaw || 0).toFixed(2).replace('.', ',')}</td><td>${(d.variacao || 0).toFixed(2).replace('.', ',')}</td>`;
          }
          html += '</tr>';
        });
      }

      html += '</tbody></table></body></html>';

      let blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
      let url = URL.createObjectURL(blob);
      let link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Tasy_Pempfrg_${$scope.config.dimensao}_${new Date().toISOString().substring(0,10)}.xls`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function() { URL.revokeObjectURL(url); }, 1000);

      $scope.mostrarToast('Planilha Excel gerada com sucesso!', 'sucesso');
    };

    $scope.copiarTabela = function() {
      if (!$scope.respostaBackend || !$scope.respostaBackend.dados) return;

      let res = $scope.respostaBackend;
      let textRows = [];

      if (res.modoTodos) {
        var pctTxt = function(v) { return v != null ? Number(v).toFixed(1) + '%' : '—'; };
        textRows.push([
          res.nomeDimensao, 'Qtd. Contas', 'Qtd. Proc.', 'Qtd. Mat/Med',
          'Val. Produzido', 'Val. Faturado', 'Val. Recebido',
          'Val. Glosado', '% Glosa', 'Val. Adicional', 'Repasse Médico'
        ].join('\t'));
        res.dados.forEach(d => {
          textRows.push([
            d.label, d.qtd_contas_fmt, d.qtd_procedimentos_fmt, d.qtd_matmed_fmt,
            d.valor_produzido_fmt, d.valor_faturado_fmt, d.valor_recebido_fmt,
            d.valor_glosado_fmt, pctTxt(d.taxa_glosa), d.valor_adicional_fmt, d.valor_medico_fmt
          ].join('\t'));
        });
      } else {
        textRows.push([res.nomeDimensao, res.nomeIndicador].join('\t'));
        res.dados.forEach(d => {
          textRows.push([d.label, d.valorFormatado].join('\t'));
        });
      }

      let textoFinal = textRows.join('\n');

      function copiarViaExecCommand() {
        let ta = document.createElement('textarea');
        ta.value = textoFinal;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);

        $scope.$apply(function() {
          if (ok) $scope.mostrarToast('Dados copiados para a área de transferência!', 'sucesso');
          else $scope.mostrarToast('Não foi possível copiar automaticamente.', 'erro');
        });
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textoFinal).then(function() {
          $scope.$apply(function() {
            $scope.mostrarToast('Dados copiados para a área de transferência!', 'sucesso');
          });
        }).catch(copiarViaExecCommand);
      } else {
        copiarViaExecCommand();
      }
    };

    $scope.imprimirRelatorio = function() {
      $scope.dataEmissaoImpressao = new Date().toLocaleString('pt-BR');
      $timeout(function() {
        window.print();
      }, 100);
    };

    // ----------------------------------------------------------------------
    // PLUGIN: RÓTULOS DE VALOR NO FIM DAS BARRAS (MODO INDIVIDUAL)
    // ----------------------------------------------------------------------
    var pluginRotulosBarras = {
      id: 'rotulosBarras',
      afterDatasetsDraw: function(chart, args, opts) {
        if (!opts || !opts.ativo || !opts.formatar) return;
        var cg = coresGrafico();
        var ctx = chart.ctx;
        var horizontal = chart.options.indexAxis === 'y';
        ctx.save();
        ctx.font = '600 10px Inter, sans-serif';
        ctx.fillStyle = cg.rotuloValor;
        chart.data.datasets.forEach(function(ds, di) {
          var meta = chart.getDatasetMeta(di);
          if (meta.hidden) return;
          meta.data.forEach(function(barra, i) {
            var val = ds.data[i];
            if (val === null || val === undefined) return;
            ctx.textAlign = horizontal ? 'left' : 'center';
            ctx.textBaseline = horizontal ? 'middle' : 'bottom';
            var x = horizontal ? barra.x + 6 : barra.x;
            var y = horizontal ? barra.y : barra.y - 4;
            ctx.fillText(opts.formatar(val), x, y);
          });
        });
        ctx.restore();
      }
    };

    // ----------------------------------------------------------------------
    // RENDERIZAÇÃO DOS GRÁFICOS (CHART.JS ENGINE)
    // ----------------------------------------------------------------------
    function renderizarGraficos(dadosResp) {
      if (chart1) { chart1.destroy(); chart1 = null; }
      if (chart2) { chart2.destroy(); chart2 = null; }

      Chart.defaults.font.family = "'Inter', sans-serif";
      let cg = coresGrafico();
      let labels = dadosResp.dados.map(d => d.label);
      let configMap = ApiService.getConfigIndicadores();

      let chartType = $scope.tipoGraficoVisual === 'horizontalBar' ? 'bar' : $scope.tipoGraficoVisual;
      let isHorizontal = $scope.tipoGraficoVisual === 'horizontalBar';

      let datasets1 = [];
      let datasets2 = [];
      let scalesConfig = {};

      // MODO MULTIVARIADO (TODOS OS INDICADORES)
      if (dadosResp.modoTodos) {
        let chavesFiltradas = Object.keys(configMap);

        if ($scope.filtroSerieGrafico === 'financeiro') {
          chavesFiltradas = chavesFiltradas.filter(k => configMap[k].isMoeda);
        } else if ($scope.filtroSerieGrafico === 'quantidades') {
          chavesFiltradas = chavesFiltradas.filter(k => !configMap[k].isMoeda);
        } else if ($scope.filtroSerieGrafico === 'faturamento_vs_glosa') {
          chavesFiltradas = ['valor_faturado', 'valor_recebido', 'valor_glosado'];
        }

        chavesFiltradas.forEach(key => {
          let ind = configMap[key];
          datasets1.push({
            label: ind.nome,
            data: dadosResp.dados.map(d => d[key]),
            backgroundColor: corDeIndicador(key, ind.color),
            borderRadius: 4,
            isMoeda: ind.isMoeda,
            xAxisID: isHorizontal ? (ind.isMoeda ? 'xFinanc' : 'xVol') : undefined,
            yAxisID: !isHorizontal ? (ind.isMoeda ? 'yFinanc' : 'yVol') : undefined
          });
        });

        let temMoeda = chavesFiltradas.some(k => configMap[k].isMoeda);
        let temVol = chavesFiltradas.some(k => !configMap[k].isMoeda);

        if (isHorizontal) {
          scalesConfig = {
            y: {
              grid: { display: false },
              ticks: { font: { size: 11.5, weight: '600' }, color: cg.legenda }
            }
          };

          if (temMoeda) {
            scalesConfig.xFinanc = {
              type: 'linear',
              position: 'bottom',
              title: { display: true, text: 'Valores Financeiros (R$)', font: { size: 10, weight: '700' }, color: '#2563eb' },
              grid: { color: cg.grid },
              ticks: {
                font: { size: 10.5 },
                color: cg.tick,
                callback: function(v) {
                  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
                }
              }
            };
          }

          if (temVol) {
            scalesConfig.xVol = {
              type: 'linear',
              position: 'top',
              title: { display: true, text: 'Quantidades', font: { size: 10, weight: '700' }, color: '#0284c7' },
              grid: { drawOnChartArea: !temMoeda },
              ticks: {
                font: { size: 10.5 },
                color: cg.tick,
                callback: function(v) { return v.toLocaleString('pt-BR'); }
              }
            };
          }

        } else {
          // Colunas Verticais
          scalesConfig = {
            x: {
              grid: { display: false },
              ticks: { font: { size: 11, weight: '600' }, color: cg.legenda }
            }
          };

          if (temMoeda) {
            scalesConfig.yFinanc = {
              type: 'linear',
              position: 'left',
              title: { display: true, text: 'Valores (R$)', font: { size: 10, weight: '700' } },
              grid: { color: cg.grid },
              ticks: {
                callback: function(v) {
                  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
                }
              }
            };
          }

          if (temVol) {
            scalesConfig.yVol = {
              type: 'linear',
              position: temMoeda ? 'right' : 'left',
              title: { display: true, text: 'Quantidades', font: { size: 10, weight: '700' } },
              grid: { drawOnChartArea: !temMoeda },
              ticks: {
                callback: function(v) { return v.toLocaleString('pt-BR'); }
              }
            };
          }
        }

      } else {
        // MODO INDICADOR INDIVIDUAL
        let rotuloAtual = dadosResp.nomeIndicador + ($scope.filtrosTop.modoVisao === 'comparativo' ? ' (Atual)' : '');

        if ($scope.tipoGraficoVisual === 'doughnut') {
          const paletaDoughnut = ['#0284c7', '#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#e11d48', '#475569', '#0d9488', '#ea580c'];
          datasets1.push({
            label: rotuloAtual,
            data: dadosResp.dados.map(d => d.valorRaw),
            backgroundColor: dadosResp.dados.map(function(_, i){ return paletaDoughnut[i % paletaDoughnut.length]; }),
            borderWidth: 2,
            borderColor: cg.bordaRosca,
            isMoeda: dadosResp.isMoeda,
            isPercentual: dadosResp.isPercentual
          });
          scalesConfig = {};

        } else {
          datasets1.push({
            label: rotuloAtual,
            data: dadosResp.dados.map(d => d.valorRaw),
            backgroundColor: corDeIndicador($scope.config.indicador, dadosResp.color),
            borderRadius: 4,
            isMoeda: dadosResp.isMoeda,
            isPercentual: dadosResp.isPercentual
          });

          if ($scope.filtrosTop.modoVisao === 'comparativo') {
            datasets2.push({
              label: dadosResp.nomeIndicador + ' (Anterior: ' + $scope.infoPeriodo.rotuloAnterior + ')',
              data: dadosResp.dados.map(d => d.valorAnteriorRaw),
              backgroundColor: cg.barraAnterior,
              borderRadius: 4,
              isMoeda: dadosResp.isMoeda,
              isPercentual: dadosResp.isPercentual
            });
          }

          if (isHorizontal) {
            scalesConfig = {
              y: {
                grid: { display: false },
                ticks: { font: { size: 11.5, weight: '600' }, color: cg.legenda }
              },
              x: {
                grid: { color: cg.grid },
                ticks: {
                  font: { size: 10.5 },
                  color: cg.tick,
                  callback: function(v) {
                    if (dadosResp.isPercentual) return v + '%';
                    if (dadosResp.isMoeda) return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
                    return v.toLocaleString('pt-BR');
                  }
                }
              }
            };
          } else {
            scalesConfig = {
              x: {
                grid: { display: false },
                ticks: { font: { size: 11, weight: '600' }, color: cg.legenda }
              },
              y: {
                grid: { color: cg.grid },
                ticks: {
                  font: { size: 10.5 },
                  color: cg.tick,
                  callback: function(v) {
                    if (dadosResp.isPercentual) return v + '%';
                    if (dadosResp.isMoeda) return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
                    return v.toLocaleString('pt-BR');
                  }
                }
              }
            };
          }
        }
      }

      const exibirRotulos = !dadosResp.modoTodos && $scope.tipoGraficoVisual !== 'doughnut';

      const opcoesGrafico = {
        indexAxis: isHorizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: exibirRotulos ? (isHorizontal ? { right: 70 } : { top: 20 }) : 0 },
        animation: { duration: 400 },
        plugins: { 
          legend: { 
            display: dadosResp.modoTodos || $scope.filtrosTop.modoVisao === 'comparativo' || $scope.tipoGraficoVisual === 'doughnut',
            position: 'top',
            labels: { 
              font: { size: 11.5, weight: '600' }, 
              boxWidth: 12, 
              padding: 10,
              color: cg.legenda
            }
          },
          tooltip: {
            padding: 10,
            backgroundColor: cg.tooltipBg,
            titleFont: { size: 12.5, weight: '700' },
            bodyFont: { size: 12, weight: '500' },
            cornerRadius: 6,
            callbacks: {
              label: function(context) {
                let val = context.raw || 0;
                let isMoeda = context.dataset.isMoeda !== undefined ? context.dataset.isMoeda : dadosResp.isMoeda;
                let isPercentual = context.dataset.isPercentual !== undefined ? context.dataset.isPercentual : dadosResp.isPercentual;
                let labelName = context.dataset.label || '';
                
                let fmt = '';
                if (isPercentual) {
                  fmt = val.toFixed(1) + '%';
                } else if (isMoeda) {
                  fmt = val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                } else {
                  fmt = Math.round(val).toLocaleString('pt-BR');
                }
                
                let variacaoTexto = '';
                if ($scope.filtrosTop.modoVisao === 'comparativo' && !dadosResp.modoTodos) {
                  let itemData = dadosResp.dados[context.dataIndex];
                  if (itemData && itemData.variacao !== undefined) {
                    let sinal = itemData.variacao >= 0 ? '+' : '';
                    variacaoTexto = ` (${sinal}${itemData.variacao.toFixed(1)}%)`;
                  }
                }
                
                return ` ${labelName}: ${fmt}${variacaoTexto}`;
              }
            }
          },
          rotulosBarras: {
            ativo: exibirRotulos,
            formatar: function(v) { return fmtValorCurto(v, dadosResp.isMoeda, dadosResp.isPercentual); }
          }
        },
        scales: scalesConfig
      };

      const canvas1 = document.getElementById('chartPrincipal');
      if (canvas1) {
        const ctx1 = canvas1.getContext('2d');
        chart1 = new Chart(ctx1, { 
          type: chartType, 
          data: { labels: labels, datasets: datasets1 }, 
          options: opcoesGrafico,
          plugins: [pluginRotulosBarras]
        });
      }

      if ($scope.filtrosTop.modoVisao === 'comparativo' && !dadosResp.modoTodos && $scope.tipoGraficoVisual !== 'doughnut') {
        const canvas2 = document.getElementById('chartSecundario');
        if (canvas2) {
          const ctx2 = canvas2.getContext('2d');
          chart2 = new Chart(ctx2, { 
            type: chartType, 
            data: { labels: labels, datasets: datasets2 }, 
            options: opcoesGrafico,
            plugins: [pluginRotulosBarras]
          });
        }
      }
    }

    // ----------------------------------------------------------------------
    // BOOT: pinta instantaneamente com a última consulta em cache
    // (stale-while-revalidate — os watchers disparam a consulta real em seguida)
    // ----------------------------------------------------------------------
    aplicarCacheInicial();

    // ----------------------------------------------------------------------
    // RESPONSIVIDADE DOS GRÁFICOS — RESIZE / ZOOM / ORIENTAÇÃO
    // Re-renderiza com debounce quando o layout muda (janela, zoom do
    // navegador, rotação, toggle da sidebar). O ResizeObserver cobre
    // mudanças internas de largura que não disparam window.resize.
    // ----------------------------------------------------------------------
    var resizeTimer = null;

    function reagendarRenderGraficos() {
      if (resizeTimer) $timeout.cancel(resizeTimer);
      resizeTimer = $timeout(function() {
        if (!$scope.respostaBackend || !$scope.respostaBackend.dados) return;
        // Aguarda um frame de layout antes de medir/pintar (evita canvas
        // com largura/altura defasada no modo multivariado)
        requestAnimationFrame(function() {
          safeApply(function() {
            if (chart1 || chart2) renderizarGraficos($scope.respostaBackend);
            if ($scope.tendenciaTemDados && !$scope.tendenciaCarregando) renderizarTendencia();
            if ($scope.modalDrillAberto && $scope.drillSerie) renderizarChartDrill();
            if (chart1 && chart1.resize) chart1.resize();
            if (chart2 && chart2.resize) chart2.resize();
            if (typeof chart3 !== 'undefined' && chart3 && chart3.resize) chart3.resize();
          });
        });
      }, 200);
    }

    window.addEventListener('resize', reagendarRenderGraficos);
    window.addEventListener('orientationchange', reagendarRenderGraficos);
    // Pinch-zoom / zoom dinâmico em navegadores móveis
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', reagendarRenderGraficos);
    }

    if (window.ResizeObserver) {
      var alvoLayout = document.querySelector('.dashboard-scroll');
      if (alvoLayout) {
        new ResizeObserver(function() { reagendarRenderGraficos(); }).observe(alvoLayout);
      }
    } else {
      // Fallback: intervalo leve compara dimensões (navegadores antigos)
      var ultLargura = document.documentElement.clientWidth;
      setInterval(function() {
        var w = document.documentElement.clientWidth;
        if (w !== ultLargura) { ultLargura = w; reagendarRenderGraficos(); }
      }, 400);
    }    // Limpeza de listeners globais ao destruir o escopo (evita memory leak)
    $scope.$on('$destroy', function() {
      try { document.removeEventListener('click', handlerClickFora); } catch(e) {}
      try { document.removeEventListener('keydown', handlerTecladoGlobal); } catch(e) {}
      try { window.removeEventListener('resize', reagendarRenderGraficos); } catch(e) {}
      try { window.removeEventListener('orientationchange', reagendarRenderGraficos); } catch(e) {}
      try { if (window.visualViewport) window.visualViewport.removeEventListener('resize', reagendarRenderGraficos); } catch(e) {}
      try { if (_resizeObserverInst && _resizeAlvo) _resizeObserverInst.unobserve(_resizeAlvo); } catch(e) {}
      try { if (_resizeObserverInst) _resizeObserverInst.disconnect(); } catch(e) {}
      try { if (typeof _fallbackInterval !== 'undefined' && _fallbackInterval) clearInterval(_fallbackInterval); } catch(e) {}
      try { if (resizeTimer) $timeout.cancel(resizeTimer); } catch(e) {}
      try { if (debounceTimer) $timeout.cancel(debounceTimer); } catch(e) {}
      try { if (toastTimer) $timeout.cancel(toastTimer); } catch(e) {}
      try { if (chart1) { chart1.destroy(); chart1=null; } } catch(e) {}
      try { if (chart2) { chart2.destroy(); chart2=null; } } catch(e) {}
      try { if (typeof chart3 !== 'undefined' && chart3) { chart3.destroy(); chart3=null; } } catch(e) {}
      try { if (typeof chartDrill !== 'undefined' && chartDrill) { chartDrill.destroy(); chartDrill=null; } } catch(e) {}
    });



    // ----------------------------------------------------------------------
    // ATALHOS DE TECLADO GLOBAIS
    // ----------------------------------------------------------------------
    var handlerTecladoGlobal = function(ev) {
      var alvo = ev.target || {};
      var tag = (alvo.tagName || '').toLowerCase();
      var digitando = tag === 'input' || tag === 'textarea' || tag === 'select' || alvo.isContentEditable;

      if (ev.key === 'Escape') {
        if ($scope.modalDrillAberto || $scope.modalViewAberto ||
            $scope.filtrosBusca.tabela || $scope.filtroSidebar ||
            $scope.menuExportarAberto || $scope.painelColunasAberto ||
            $scope.painelMetasAberto || $scope.painelDicionarioAberto) {
          safeApply(function() {
            $scope.fecharMenusFlutuantes();
            $scope.fecharDrillDown();
            $scope.cancelarSalvarView();
            $scope.filtrosBusca.tabela = '';
            $scope.aplicarFiltroTabela();
            $scope.filtroSidebar = '';
          });
        }
        return;
      }

      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
        ev.preventDefault();
        var inpSidebar = document.getElementById('buscaSidebarInput');
        if (inpSidebar) { inpSidebar.focus(); inpSidebar.select(); }
        return;
      }

      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'e') {
        ev.preventDefault();
        safeApply(function() { $scope.exportarCSV(); });
        return;
      }

      if (!digitando && ev.key === '/') {
        var inpTabela = document.getElementById('buscaTabelaInput');
        if (inpTabela) {
          ev.preventDefault();
          inpTabela.focus();
        }
      }
      };
    document.addEventListener('keydown', handlerTecladoGlobal);

  });
