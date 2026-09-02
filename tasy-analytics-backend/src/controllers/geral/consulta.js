const pool = require('../../config/database');
const { extrairPeriodo } = require('../../utils/periodo');
const { aplicarEscopo } = require('../../services/escopoAcesso');
const { FONTES, num, ehComposta } = require('./fontes');
const { formatarValor } = require('./indicadores');
const { extrairFontesSql, extrairCamposSql } = require('../../utils/extrairFontes');
const logger = require('../../config/logger');

// ═══════════════════════════════════════════════════════════════════
// PAINEL GERAL — montagem e execução de queries
// ═══════════════════════════════════════════════════════════════════
// Nenhuma query do painel é escrita à mão: todas saem daqui a partir
// de FONTES × DIMENSOES. Isso garante que toda dimensão nova já nasce
// com o marcador /* ESCOPO */ no lugar certo (exigência de segurança —
// ver docs/SEGURANCA.md) e com o mesmo tratamento de período.

function construirQuery(dim, opcoes) {
  const o = opcoes || {};
  const fonte = FONTES[dim.fonte];

  // Drill-down: troca o rótulo pela expressão de mês da fonte e prende
  // a query num único item da dimensão original ($3).
  const label = o.porMes ? fonte.mesLabel : dim.label;
  const filtroItem = o.porMes && o.filtrarItem ? 'AND ' + dim.label + ' = $3' : '';
  const anoInteiro = o.porMes || !!dim.anoInteiro;

  const partes = [
    'SELECT ' + label + ' as label,' + fonte.metricas,
    fonte.from,
    fonte.joinsBase || '',
    dim.joins || '',
    'WHERE ' + fonte.where,
    dim.filtro || '',
    filtroItem,
    '/* ESCOPO */',
    'GROUP BY ' + label,
    anoInteiro ? '' : (fonte.having || '')
  ];

  // Dimensão de cardinalidade alta (materiais, procedimentos, pessoas):
  // corta o top N no banco em vez de trazer dezenas de milhares de
  // linhas que a aplicação descartaria logo depois.
  if (dim.topSql && !o.porMes) {
    partes.push('ORDER BY ' + fonte.metricaPrincipal + ' DESC NULLS LAST');
    partes.push('LIMIT ' + dim.topSql);
  }

  return partes.filter(Boolean).join('\n');
}

// ── Dimensões compostas (duas fontes cruzadas) ─────────────────────
// Cada parte vira uma query independente na sua própria tabela; o que
// as une é o RÓTULO. Ver a nota longa em geral/fontes.js sobre por que
// não é um join SQL e onde isso é (e não é) seguro.
function configDaParte(dim, parte) {
  return (dim.partes && dim.partes[parte.fonte]) || {};
}

function construirQueryParte(dim, parte, opcoes) {
  const o = opcoes || {};
  const fonte = FONTES[parte.fonte];
  const cfg = configDaParte(dim, parte);
  const label = o.porMes ? fonte.mesLabel : cfg.label;
  const filtroItem = o.porMes && o.filtrarItem ? 'AND ' + cfg.label + ' = $3' : '';
  const anoInteiro = o.porMes || !!dim.anoInteiro;

  return [
    'SELECT ' + label + ' as label,' + fonte.metricas,
    fonte.from,
    fonte.joinsBase || '',
    cfg.joins || '',
    'WHERE ' + fonte.where,
    cfg.filtro || '',
    filtroItem,
    '/* ESCOPO */',
    'GROUP BY ' + label,
    anoInteiro ? '' : (fonte.having || '')
  ].filter(Boolean).join('\n');
}

// Casa as linhas das duas partes pelo rótulo e prefixa as colunas
// cruas (a_ / b_), que é o formato que o `montar()` da composta espera.
// Rótulo presente num lado só entra com zero do outro — é o preço de
// cruzar fontes que o banco não sabe juntar em tempo de tela.
function fundirPartes(fonte, resultados) {
  const mapa = new Map();
  fonte.partes.forEach(function (parte, i) {
    resultados[i].rows.forEach(function (row) {
      const chave = row.label == null || row.label === '' ? 'Não Informado' : String(row.label);
      let alvo = mapa.get(chave);
      if (!alvo) { alvo = { label: chave }; mapa.set(chave, alvo); }
      Object.keys(row).forEach(function (col) {
        if (col === 'label') return;
        alvo[parte.prefixo + col] = num(row[col]);
      });
    });
  });
  return Array.from(mapa.values());
}

function fundirTotais(fonte, resultados) {
  const alvo = {};
  fonte.partes.forEach(function (parte, i) {
    const row = resultados[i].rows[0] || {};
    Object.keys(row).forEach(function (col) { alvo[parte.prefixo + col] = num(row[col]); });
  });
  return alvo;
}

// Ponto único de execução de uma dimensão: quem chama não precisa saber
// se ela é simples ou composta — sai sempre { rows } no formato que
// montarLinha/consolidar consomem.
function consultarDimensao(dim, usuario, periodo, opcoes) {
  const o = opcoes || {};
  const fonte = FONTES[dim.fonte];
  const evolucao = !!o.porMes || !!dim.anoInteiro;

  if (!ehComposta(fonte)) {
    const sql = construirQuery(dim, o);
    return executar(sql, dim.fonte, usuario, periodo, evolucao, o.extras)
      .then(function (r) { return { rows: r.rows }; });
  }

  return Promise.all(fonte.partes.map(function (parte) {
    return executar(construirQueryParte(dim, parte, o), parte.fonte, usuario, periodo, evolucao, o.extras);
  })).then(function (resultados) {
    return { rows: fundirPartes(fonte, resultados) };
  });
}

// Total da base inteira (sem GROUP BY) para a dimensão.
function consultarTotalDimensao(dim, usuario, periodo) {
  const fonte = FONTES[dim.fonte];
  const evolucao = !!dim.anoInteiro;

  if (!ehComposta(fonte)) {
    const sql = construirQueryTotal(fonte, dim.filtro, dim.joins);
    return executar(sql, dim.fonte, usuario, periodo, evolucao)
      .then(function (r) { return { rows: r.rows }; });
  }

  return Promise.all(fonte.partes.map(function (parte) {
    const cfg = configDaParte(dim, parte);
    return executar(construirQueryTotal(FONTES[parte.fonte], cfg.filtro, cfg.joins),
      parte.fonte, usuario, periodo, evolucao);
  })).then(function (resultados) {
    return { rows: [fundirTotais(fonte, resultados)] };
  });
}

// Tabelas ods.* de uma fonte, para exibir a origem dos dados na tela.
function fontesTabelas(fonteId) {
  const fonte = FONTES[fonteId];
  if (ehComposta(fonte)) {
    return [...new Set(fonte.partes.reduce(function (acc, p) {
      return acc.concat(fontesTabelas(p.fonte));
    }, []))];
  }
  return extrairFontesSql(fonte.from + ' ' + (fonte.joinsBase || ''));
}

// Origem dos dados de uma dimensão qualquer, para o popover de auditoria.
// Numa composta, junta tabelas, campos e filtros das duas partes — é ali
// que a direção vê que aquele número saiu de dois lugares diferentes.
function origemDadosDimensao(dim) {
  const fonte = FONTES[dim.fonte];
  if (!ehComposta(fonte)) return origemDadosFonte(dim.fonte, dim.joins, dim.filtro);

  const tabelas = [];
  const campos = {};
  const filtros = [];
  fonte.partes.forEach(function (parte) {
    const cfg = configDaParte(dim, parte);
    const o = origemDadosFonte(parte.fonte, cfg.joins, cfg.filtro);
    o.tabelas.forEach(function (t) { if (tabelas.indexOf(t) === -1) tabelas.push(t); });
    Object.keys(o.campos || {}).forEach(function (k) { campos[k] = o.campos[k]; });
    filtros.push(o.filtro);
  });
  return { tabelas: tabelas, campos: campos, filtro: filtros.join('  ·  ') };
}

// Metadados completos (tabelas + campo cru de cada métrica + filtro de
// período) de uma fonte, para o popover de auditoria "de onde veio isso".
function origemDadosFonte(fonteId, joinsExtra, filtroExtra) {
  const fonte = FONTES[fonteId];
  return {
    tabelas: extrairFontesSql(fonte.from + ' ' + (fonte.joinsBase || '') + ' ' + (joinsExtra || '')),
    campos: extrairCamposSql(fonte.metricas),
    filtro: (fonte.where + ' ' + (filtroExtra || '')).replace(/\s+/g, ' ').trim()
  };
}

// Query agregada da fonte inteira (sem GROUP BY) — usada pelos blocos
// de KPI do resumo executivo.
function construirQueryTotal(fonte, filtro, joins) {
  return [
    'SELECT ' + fonte.metricas.trim(),
    fonte.from,
    fonte.joinsBase || '',
    joins || '',
    'WHERE ' + fonte.where,
    filtro || '',
    '/* ESCOPO */'
  ].filter(Boolean).join('\n');
}

// Série mensal da fonte inteira — usada pela evolução consolidada.
function construirQueryMensal(fonte, filtro, joins) {
  return [
    'SELECT ' + fonte.mesLabel + ' as mes,' + fonte.metricas,
    fonte.from,
    fonte.joinsBase || '',
    joins || '',
    'WHERE ' + fonte.where,
    filtro || '',
    '/* ESCOPO */',
    'GROUP BY ' + fonte.mesLabel
  ].filter(Boolean).join('\n');
}

// ── Período ────────────────────────────────────────────────────────
function periodoDoAno(ano, mes) {
  const a = parseInt(ano, 10);
  if (!mes) {
    return { anoRef: String(a), mesRef: null, dataInicio: a + '-01-01', dataFim: a + '-12-31' };
  }
  const m = parseInt(mes, 10);
  const ultimoDia = new Date(a, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  return {
    anoRef: String(a),
    mesRef: mm,
    dataInicio: a + '-' + mm + '-01',
    dataFim: a + '-' + mm + '-' + String(ultimoDia).padStart(2, '0')
  };
}

function resolverPeriodo(body) {
  const periodo = extrairPeriodo(body);
  if (!periodo.anoRef) return periodoDoAno(new Date().getFullYear(), null);
  return periodo;
}

// dataInicio === dataFim só acontece com tipoPeriodo 'dia' (mês/ano sempre
// cobrem um intervalo de mais de um dia) — usamos isso para distinguir os
// dois sem precisar carregar o tipoPeriodo original até aqui.
function ehDia(periodo) {
  return !!periodo.dataInicio && periodo.dataInicio === periodo.dataFim;
}

function periodoDoDia(dataStr) {
  const d = new Date(dataStr + 'T00:00:00');
  const ano = String(d.getFullYear());
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  const data = ano + '-' + mes + '-' + dia;
  return { anoRef: ano, mesRef: mes, dataInicio: data, dataFim: data };
}

// Comparação: dia escolhido → dia anterior; mês escolhido → mês anterior;
// ano inteiro → ano anterior.
function periodoAnterior(periodo) {
  if (ehDia(periodo)) {
    const d = new Date(periodo.dataInicio + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    return periodoDoDia(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
  }
  const ano = parseInt(periodo.anoRef, 10);
  if (!periodo.mesRef) return periodoDoAno(ano - 1, null);
  const mes = parseInt(periodo.mesRef, 10);
  return mes === 1 ? periodoDoAno(ano - 1, 12) : periodoDoAno(ano, mes - 1);
}

function rotuloPeriodo(periodo) {
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  if (ehDia(periodo)) {
    const partes = periodo.dataInicio.split('-');
    return partes[2] + '/' + partes[1] + '/' + partes[0];
  }
  if (!periodo.mesRef) return periodo.anoRef;
  return MESES[parseInt(periodo.mesRef, 10) - 1] + '/' + periodo.anoRef;
}

// ── Execução ───────────────────────────────────────────────────────
// O servidor de banco tem /dev/shm pequeno: quando várias agregações
// grandes rodam juntas, os workers paralelos do Postgres não conseguem
// alocar o segmento de memória compartilhada e a query morre com
// "could not resize shared memory segment ... No space left on device".
// Não é erro de SQL nem falta de disco — é limite do host, que não
// controlamos (o banco é read-only de terceiro).
//
// Em vez de deixar o painel quebrar, refazemos a consulta sem
// paralelismo: mais lenta, porém sem segmento compartilhado nenhum.
// SET LOCAL exige transação e morre junto com ela, então a conexão
// volta limpa para o pool.
const ERRO_MEMORIA_COMPARTILHADA = /shared memory segment|No space left on device|out of shared memory/i;

function executarSemParalelismo(sql, params) {
  return pool.connect().then(function (client) {
    return client.query('BEGIN READ ONLY')
      .then(function () { return client.query('SET LOCAL max_parallel_workers_per_gather = 0'); })
      .then(function () { return client.query(sql, params); })
      .then(function (r) { return client.query('COMMIT').then(function () { return r; }); })
      .catch(function (e) {
        return client.query('ROLLBACK').catch(function () { /* conexão já perdida */ })
          .then(function () { return Promise.reject(e); });
      })
      .finally(function () { client.release(); });
  });
}

function executar(sql, fonteId, usuario, periodo, anoInteiro, extras) {
  const fonte = FONTES[fonteId];
  const params = fonte.params(periodo, anoInteiro).concat(extras || []);
  const consulta = aplicarEscopo(sql, usuario, fonte.tabelaEscopo, params);

  return pool.query(consulta.query, consulta.parametros).catch(function (erro) {
    if (!ERRO_MEMORIA_COMPARTILHADA.test(erro.message || '')) return Promise.reject(erro);
    logger.warn('[geral] paralelismo indisponível no banco (' + fonteId + '); refazendo em modo serial');
    return executarSemParalelismo(consulta.query, consulta.parametros);
  });
}

// ── Montagem de resultados ─────────────────────────────────────────
// Soma as colunas CRUAS e só então recalcula os derivados: a média dos
// percentuais/tickets linha a linha não é o percentual do consolidado.
function consolidar(fonte, rows) {
  const bruto = {};
  rows.forEach(function (row) {
    Object.keys(row).forEach(function (col) {
      if (col === 'label' || col === 'mes') return;
      bruto[col] = (bruto[col] || 0) + num(row[col]);
    });
  });
  return fonte.montar(bruto);
}

function montarLinha(fonte, row, indicadorAtivo) {
  const valores = fonte.montar(row);
  const item = { label: row.label == null || row.label === '' ? 'Não Informado' : String(row.label) };
  fonte.indicadores.forEach(function (chave) {
    item[chave] = valores[chave] || 0;
    item[chave + '_fmt'] = formatarValor(chave, valores[chave]);
  });
  item.valorRaw = item[indicadorAtivo];
  item.valorFormatado = item[indicadorAtivo + '_fmt'];
  return item;
}

function montarTotais(fonte, rows) {
  const consolidado = consolidar(fonte, rows);
  const naoAditivos = fonte.naoAditivos || [];
  const totais = {};
  fonte.indicadores.forEach(function (chave) {
    totais[chave] = consolidado[chave] || 0;
    totais[chave + '_fmt'] = (naoAditivos.indexOf(chave) !== -1 ? '≈ ' : '') +
      formatarValor(chave, consolidado[chave]);
  });
  return totais;
}

function variacao(atual, anterior) {
  if (anterior === 0) return atual === 0 ? 0 : null; // null = "sem base de comparação"
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

module.exports = {
  construirQuery,
  construirQueryParte,
  consultarDimensao,
  consultarTotalDimensao,
  fontesTabelas,
  origemDadosFonte,
  origemDadosDimensao,
  construirQueryTotal,
  construirQueryMensal,
  resolverPeriodo,
  periodoDoAno,
  periodoAnterior,
  rotuloPeriodo,
  executar,
  consolidar,
  montarLinha,
  montarTotais,
  variacao
};
