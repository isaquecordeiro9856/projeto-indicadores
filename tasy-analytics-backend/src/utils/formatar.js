function formatarMoeda(valor) {
  return (valor || 0).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 2
  });
}

function formatarPercentual(valor) {
  return (valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 1, maximumFractionDigits: 2
  }) + '%';
}

function formatarNumero(valor) {
  return Math.round(valor || 0).toLocaleString('pt-BR');
}

function formatarDecimal(valor) {
  return (valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 1, maximumFractionDigits: 2
  }) + ' dias';
}

function calcularVariacao(atual, anterior) {
  if (!anterior || anterior === 0) return 0;
  return ((atual - anterior) / anterior) * 100;
}

module.exports = { formatarMoeda, formatarPercentual, formatarNumero, formatarDecimal, calcularVariacao };
