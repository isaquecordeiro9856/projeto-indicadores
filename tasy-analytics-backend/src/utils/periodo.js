// toISOString converte para UTC e, no fuso do Brasil (-03), joga a data um dia
// para trás (2024-01-01 vira 2023-12-31). Formatamos com os getters locais.
function formatarData(data) {
  return data.getFullYear() + '-' +
    String(data.getMonth() + 1).padStart(2, '0') + '-' +
    String(data.getDate()).padStart(2, '0');
}

function extrairPeriodo(req) {
  const { tipoPeriodo, periodoValor } = req;

  if (!tipoPeriodo || periodoValor == null || periodoValor === '') {
    return { dataInicio: null, dataFim: null, anoRef: null, mesRef: null };
  }

  // new Date(string) trata string no formato "AAAA-MM-DD"/"AAAA-MM" como ISO
  // e interpreta em UTC — no fuso do Brasil (-03) os getters locais usados
  // abaixo então recuam um dia (ou um mês). Por isso extraímos ano/mês/dia
  // diretamente da string com regex, em vez de deixar o Date parsear.
  const partes = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(String(periodoValor).trim());
  let data;
  if (partes) {
    const ano = Number(partes[1]);
    const mes = partes[2] ? Number(partes[2]) - 1 : 0;
    const dia = partes[3] ? Number(partes[3]) : 1;
    data = new Date(ano, mes, dia);
  } else {
    data = new Date(periodoValor);
  }
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
    dataInicio: formatarData(dataInicio),
    dataFim: formatarData(dataFim),
    anoRef,
    mesRef
  };
}

function obterLimite(req) {
  const limite = parseInt(req.limite, 10);
  if (isNaN(limite) || limite <= 0) return 999;
  return limite;
}

// Intervalo [inicio, fimExclusivo) do ano de anoRef, em vez de comparar com
// EXTRACT(YEAR FROM coluna) = ano: EXTRACT aplica uma função sobre a coluna
// de data, o que impede o Postgres de usar um índice btree simples nela.
// Um range aberto na coluna crua permite usar índice quando ele existir.
function intervaloAno(anoRef) {
  const ano = parseInt(anoRef, 10);
  return {
    inicio: ano + '-01-01',
    fimExclusivo: (ano + 1) + '-01-01'
  };
}

module.exports = { extrairPeriodo, obterLimite, intervaloAno };
