function extrairPeriodo(req) {
  const { tipoPeriodo, periodoValor } = req;

  if (!tipoPeriodo || !periodoValor) {
    return { dataInicio: null, dataFim: null, anoRef: null, mesRef: null };
  }

  const data = new Date(periodoValor);
  if (isNaN(data.getTime())) {
    return { dataInicio: null, dataFim: null, anoRef: null, mesRef: null };
  }

  let dataInicio, dataFim, anoRef, mesRef;

  switch (tipoPeriodo) {
    case 'dia':
      dataInicio = data;
      dataFim = data;
      anoRef = String(data.getFullYear());
      mesRef = String(data.getMonth() + 1).padStart(2, '0');
      break;
    case 'mes':
      dataInicio = new Date(data.getFullYear(), data.getMonth(), 1);
      dataFim = new Date(data.getFullYear(), data.getMonth() + 1, 0);
      anoRef = String(data.getFullYear());
      mesRef = String(data.getMonth() + 1).padStart(2, '0');
      break;
    case 'ano':
      dataInicio = new Date(data.getFullYear(), 0, 1);
      dataFim = new Date(data.getFullYear(), 11, 31);
      anoRef = String(data.getFullYear());
      mesRef = null;
      break;
    default:
      return { dataInicio: null, dataFim: null, anoRef: null, mesRef: null };
  }

  return {
    dataInicio: dataInicio.toISOString().split('T')[0],
    dataFim: dataFim.toISOString().split('T')[0],
    anoRef,
    mesRef
  };
}

function obterLimite(req) {
  const limite = parseInt(req.limite, 10);
  if (isNaN(limite) || limite <= 0) return 999;
  return limite;
}

module.exports = { extrairPeriodo, obterLimite };
