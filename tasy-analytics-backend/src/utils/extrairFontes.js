// Extrai metadados de auditoria (tabela, campo, filtro) direto das strings
// SQL brutas dos controllers — nunca anotado à mão, para nunca ficar
// desatualizado quando uma query mudar.

function extrairFontesSql(sql) {
  if (!sql) return [];
  const matches = sql.match(/ods\.\w+/gi) || [];
  return [...new Set(matches.map((m) => m.toLowerCase()))];
}

function limparEspacos(s) {
  return s.replace(/\s+/g, ' ').trim();
}

// Divide uma lista por um separador respeitando parênteses (não quebra
// dentro de COALESCE(SUM(x), 0), por exemplo).
function dividirTopLevel(str, separador) {
  const partes = [];
  let atual = '';
  let profundidade = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '(') profundidade++;
    if (ch === ')') profundidade--;
    if (ch === separador && profundidade === 0) {
      partes.push(atual);
      atual = '';
    } else {
      atual += ch;
    }
  }
  partes.push(atual);
  return partes;
}

// Aceita tanto uma query completa ("SELECT ... FROM ...") quanto um
// fragmento cru de métricas ("SUM(x) as a, SUM(y) as b") como usado em
// controllers/geral/fontes.js.
function extrairCamposSql(trecho) {
  if (!trecho) return {};
  let lista = trecho;
  const selectMatch = /\bselect\b([\s\S]*?)\bfrom\b/i.exec(trecho);
  if (selectMatch) {
    lista = selectMatch[1];
  } else {
    const fromIdx = trecho.search(/\bfrom\b/i);
    if (fromIdx !== -1) lista = trecho.slice(0, fromIdx);
  }

  const campos = {};
  dividirTopLevel(lista, ',').forEach((parte) => {
    const limpo = limparEspacos(parte);
    if (!limpo) return;
    const comoMatch = /^(.*)\s+as\s+([a-zA-Z_][\w]*)$/i.exec(limpo);
    if (comoMatch) {
      campos[comoMatch[2].toLowerCase()] = limparEspacos(comoMatch[1]);
    } else {
      const tokens = limpo.split(/\s+/);
      const alias = tokens[tokens.length - 1].replace(/["`,]/g, '');
      campos[alias.toLowerCase()] = limpo;
    }
  });
  return campos;
}

function extrairFiltroSql(sql) {
  if (!sql) return '';
  const m = /\bwhere\b([\s\S]*?)(\bgroup\s+by\b|\border\s+by\b|\bhaving\b|\blimit\b|$)/i.exec(sql);
  if (!m) return '';
  let filtro = m[1];
  filtro = filtro.replace(/\/\*\s*ESCOPO\s*\*\//gi, '');
  filtro = limparEspacos(filtro);
  filtro = filtro.replace(/\s+and\s*$/i, '').trim();
  return filtro;
}

// Metadados completos de uma query (ou de partes dela) para exibir na
// tela: quais tabelas, qual expressão gera cada campo e qual filtro foi
// aplicado — tudo lido direto do SQL, nunca anotado manualmente.
function extrairMetadadosSql(sql) {
  return {
    tabelas: extrairFontesSql(sql),
    campos: extrairCamposSql(sql),
    filtro: extrairFiltroSql(sql)
  };
}

module.exports = { extrairFontesSql, extrairCamposSql, extrairFiltroSql, extrairMetadadosSql };
