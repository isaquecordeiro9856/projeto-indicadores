var app = angular.module('DashboardApp');

// Funções puras compartilhadas pelo DashboardController: data/período,
// formatação numérica pt-BR, normalização de texto e escape de CSV.
// Extraídas do controller porque não dependem de $scope nem de estado
// da instância — só dos parâmetros recebidos — e por isso são testáveis
// isoladamente (ver dashboard-utils.service.test.js).
app.factory('DashboardUtilsService', function() {

  function isValidDate(d) { return d instanceof Date && !isNaN(d.getTime()); }

  function criarDateMes(ano, mes0indexed) {
    return new Date(ano, mes0indexed, 1);
  }

  function formatarDataISO(d) {
    var m = d.getMonth() + 1, dia = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dia < 10 ? '0' : '') + dia;
  }

  function formatarMesISO(d) {
    var m = d.getMonth() + 1;
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m;
  }

  function deslocarPeriodoAnos(tipoPeriodo, valor, anos) {
    if (tipoPeriodo === 'ano') return (parseInt(valor, 10) || new Date().getFullYear()) + anos;
    if (valor instanceof Date) {
      var d = new Date(valor.getTime());
      d.setFullYear(d.getFullYear() + anos);
      return d;
    }
    return valor;
  }

  // Desloca o período efetivo para o período IMEDIATAMENTE anterior
  // (dia/mês/ano anterior) — usado no modo "Comparativo (vs. Anterior)".
  function deslocarPeriodoAnterior(tipoPeriodo, valor) {
    if (tipoPeriodo === 'ano') return (parseInt(valor, 10) || new Date().getFullYear()) - 1;
    if (valor instanceof Date) {
      if (tipoPeriodo === 'mes') return new Date(valor.getFullYear(), valor.getMonth() - 1, 1);
      var d = new Date(valor.getTime());
      d.setDate(d.getDate() - 1);
      return d;
    }
    return valor;
  }

  function isTipoGraficoValido(t) { return ['horizontalBar', 'bar', 'doughnut'].indexOf(t) !== -1; }

  function cssEscapeFallback(s) {
    return String(s).replace(/[^a-zA-Z0-9_-]/g, function(ch) { return '\\' + ch; });
  }

  // Normalização compartilhada (minúsculas + sem acentos)
  function normalizarTexto(txt) {
    return txt ? txt.toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") : "";
  }

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

  function truncarRotuloEixo(texto) {
    if (texto == null) return texto;
    var s = String(texto);
    return s.length > 22 ? s.slice(0, 21) + '…' : s;
  }

  function escaparCsv(txt) {
    return '"' + String(txt == null ? '' : txt).replace(/"/g, '""') + '"';
  }

  function numCsv(v) {
    return (Number(v) || 0).toFixed(2).replace('.', ',');
  }

  return {
    isValidDate: isValidDate,
    criarDateMes: criarDateMes,
    formatarDataISO: formatarDataISO,
    formatarMesISO: formatarMesISO,
    deslocarPeriodoAnos: deslocarPeriodoAnos,
    deslocarPeriodoAnterior: deslocarPeriodoAnterior,
    isTipoGraficoValido: isTipoGraficoValido,
    cssEscapeFallback: cssEscapeFallback,
    normalizarTexto: normalizarTexto,
    fmtMoedaTotal: fmtMoedaTotal,
    fmtIntTotal: fmtIntTotal,
    fmtPctTotal: fmtPctTotal,
    fmtValorCurto: fmtValorCurto,
    formatarTotalPorChave: formatarTotalPorChave,
    truncarRotuloEixo: truncarRotuloEixo,
    escaparCsv: escaparCsv,
    numCsv: numCsv
  };
});
