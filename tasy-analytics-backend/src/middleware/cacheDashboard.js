// Cache em memória das respostas dos dashboards. O usuário troca de
// indicador/ordena/atualiza a mesma dimensão repetidamente, refazendo a
// mesma query pesada no banco a cada clique — este cache evita reconsultar
// quando o filtro (dimensao/indicador/periodo/etc.) e o escopo do usuário
// já foram resolvidos há pouco tempo.
//
// Chave inclui req.usuario inteiro (não só alguns campos) para não arriscar
// vazar dado de um escopo para outro caso o token tenha campos além dos
// já mapeados em escopoAcesso.js.
const TTL_PADRAO_MS = 60 * 1000;
const LIMITE_ENTRADAS = 500;

const cache = new Map();

function limparExpirados() {
  const agora = Date.now();
  for (const [chave, entrada] of cache) {
    if (entrada.expira <= agora) cache.delete(chave);
  }
}

// TTL configurável: o Painel Geral varre o ODS inteiro (dezenas de segundos
// na primeira consulta) e olha para dados replicados que mudam de hora em
// hora, não de minuto em minuto — lá vale um TTL bem maior que o padrão.
function cacheDashboardPor(ttlMs) {
  const ttl = ttlMs || TTL_PADRAO_MS;

  return function (req, res, next) {
    const chave = JSON.stringify({ url: req.originalUrl, body: req.body, usuario: req.usuario });
    const entrada = cache.get(chave);
    const agora = Date.now();

    if (entrada && entrada.expira > agora) {
      return res.status(entrada.status).json(entrada.corpo);
    }

    const jsonOriginal = res.json.bind(res);
    res.json = function (corpo) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (cache.size >= LIMITE_ENTRADAS) limparExpirados();
        cache.set(chave, { expira: Date.now() + ttl, status: res.statusCode, corpo });
      }
      return jsonOriginal(corpo);
    };

    next();
  };
}

const cacheDashboard = cacheDashboardPor(TTL_PADRAO_MS);

module.exports = { cacheDashboard, cacheDashboardPor, TTL_PADRAO_MS };
