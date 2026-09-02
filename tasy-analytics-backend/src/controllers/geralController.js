const { FONTES } = require('./geral/fontes');
const { INDICADORES, formatarValor, metaIndicador, dicionarioIndicadores } = require('./geral/indicadores');
const { DIMENSOES, AREAS, montarCatalogo, indicadoresDaDimensao } = require('./geral/dimensoes');
const {
  construirQuery, consultarDimensao, consultarTotalDimensao,
  fontesTabelas, origemDadosFonte, origemDadosDimensao, construirQueryTotal, construirQueryMensal,
  resolverPeriodo, periodoDoAno, periodoAnterior, rotuloPeriodo,
  executar, montarLinha, montarTotais, consolidar, variacao
} = require('./geral/consulta');
const logger = require('../config/logger');

// ═══════════════════════════════════════════════════════════════════
// PAINEL GERAL — visão consolidada da direção / presidência
// ═══════════════════════════════════════════════════════════════════
// Enquanto cada painel de área tem uma fonte de dados, este cobre TODAS
// as do ODS já mapeadas. A organização é FONTES × DIMENSOES (ver
// controllers/geral/): a fonte decide quais indicadores existem, por
// isso a lista de indicadores muda conforme a dimensão escolhida.
//
// Endpoints:
//   GET  /catalogo   grupos → dimensões → indicadores (menu do painel)
//   POST /           dados de uma dimensão (+ comparativo, + drill-down)
//   POST /resumo     KPIs de um bloco (ou de todos, se não vier `bloco`)
//   POST /evolucao   séries mensais consolidadas de várias fontes
//   POST /tendencia  série mensal de UMA dimensão (o corte inteiro)
//
// O front pede os blocos do resumo em paralelo e pinta cada um assim
// que chega — sem isso a tela ficaria presa na fonte mais lenta.

// ═══════════════════════════════════════════════════════════════════
// BLOCOS DO RESUMO EXECUTIVO
// ═══════════════════════════════════════════════════════════════════
// Um bloco = um cartão de KPIs. `area` diz em qual aba do painel ele
// aparece, e `resumo: true` marca os poucos que também vão para a
// Visão Geral — sem isso a tela de abertura viraria uma parede de 100
// números. `pesado` fica fora do lote inicial e só é buscado sob
// demanda, para a tela abrir rápido.
// Chave composta: ver a nota em geral/dimensoes.js — sem ie_origem_proced
// o join duplica linhas e infla o valor produzido em ~17%.
const JOIN_PROC_PP = 'LEFT JOIN ods.procedimento p ON pp.cd_procedimento = p.cd_procedimento AND pp.ie_origem_proced = p.ie_origem_proced';

const BLOCOS = [
  // ── Financeiro ──
  {
    chave: 'financeiro', area: 'financeiro', resumo: true, titulo: 'Financeiro — Glosas', fonte: 'glosa_protocolo', icone: '$',
    indicadores: ['valor_faturado', 'valor_recebido', 'valor_glosado', 'pct_glosado', 'pct_recebido', 'valor_a_receber']
  },
  {
    chave: 'retorno', area: 'financeiro', titulo: 'Retorno do Convênio', fonte: 'retorno_item', icone: '⇋',
    indicadores: ['valor_pago_retorno', 'valor_glosado', 'pct_glosa_retorno', 'valor_amenor',
      'valor_adicional', 'qtd_itens_retorno']
  },
  {
    chave: 'recebimento', area: 'financeiro', resumo: true, titulo: 'Recebimentos em Caixa', fonte: 'recebimento', icone: '↓',
    indicadores: ['valor_recebimento', 'qtd_recebimentos', 'ticket_recebimento']
  },
  {
    chave: 'contas', area: 'financeiro', titulo: 'Contas Faturadas', fonte: 'conta', icone: '▦',
    indicadores: ['valor_contas', 'qtd_contas', 'ticket_conta', 'media_permanencia']
  },
  {
    chave: 'guias', area: 'financeiro', titulo: 'Guias', fonte: 'guia', icone: '▧',
    indicadores: ['valor_guias', 'qtd_guias', 'ticket_guia', 'valor_guia_convenio', 'guias_por_conta']
  },
  {
    chave: 'protocolos', area: 'financeiro', titulo: 'Protocolos ao Convênio', fonte: 'protocolo', icone: '⇥',
    indicadores: ['qtd_protocolos_conv', 'qtd_prot_fechados', 'pct_prot_fechado',
      'qtd_prot_abertos', 'qtd_prot_vencidos']
  },
  {
    chave: 'contabil', area: 'financeiro', titulo: 'Movimento Contábil', fonte: 'contabil', icone: '∑',
    indicadores: ['valor_debito', 'valor_credito', 'saldo_contabil', 'qtd_lotes']
  },

  // ── Assistencial ──
  {
    chave: 'atendimento', area: 'assistencial', resumo: true, titulo: 'Atendimentos e Desfechos', fonte: 'atendimento', icone: '◉',
    indicadores: ['qtd_atendimentos', 'qtd_pacientes', 'qtd_internacoes', 'permanencia_intern',
      'qtd_obitos', 'taxa_obito', 'taxa_urgencia', 'idade_media']
  },
  {
    chave: 'ocupacao', area: 'assistencial', resumo: true, titulo: 'Ocupação de Unidades', fonte: 'unidade', icone: '▤',
    indicadores: ['qtd_passagens', 'dias_ocupacao', 'permanencia_unidade', 'qtd_em_aberto']
  },
  {
    chave: 'producao', area: 'assistencial', resumo: true, titulo: 'Produção Assistencial', fonte: 'producao', icone: '▲',
    indicadores: ['valor_produzido', 'qtd_procedimentos', 'qtd_atendimentos', 'valor_medico',
      'ticket_atendimento', 'pct_repasse']
  },
  {
    chave: 'cirurgico', area: 'assistencial', titulo: 'Centro Cirúrgico', fonte: 'producao', icone: '✚',
    filtro: `AND pp.ie_tiss_tipo_guia = '7'`,
    indicadores: ['qtd_procedimentos', 'qtd_atendimentos', 'valor_produzido', 'valor_medio_proc']
  },
  {
    chave: 'fisioterapia', area: 'assistencial', titulo: 'Fisioterapia', fonte: 'producao', icone: '≈',
    filtro: `AND p.ds_procedimento ILIKE '%fisio%'`, joins: JOIN_PROC_PP,
    indicadores: ['qtd_procedimentos', 'qtd_atendimentos', 'valor_produzido']
  },
  {
    chave: 'diagnosticos', area: 'assistencial', titulo: 'Laudos e Diagnósticos', fonte: 'laudo', icone: '⌖',
    indicadores: ['qtd_laudos', 'qtd_atend_laudo', 'laudos_por_atend']
  },

  // ── SUS ──
  {
    chave: 'sus_aih', area: 'sus', resumo: true, titulo: 'SUS · AIH de Internação', fonte: 'sus_aih', icone: '✚',
    indicadores: ['qtd_aih', 'valor_aih', 'ticket_aih', 'perm_media_aih', 'qtd_aih_com_perm',
      'qtd_obitos_sus', 'taxa_obito_sus', 'qtd_nasc_vivos', 'qtd_longa_perm']
  },
  {
    chave: 'sus_apac', area: 'sus', titulo: 'SUS · APAC Ambulatorial', fonte: 'sus_apac', icone: '◍',
    indicadores: ['qtd_apac', 'qtd_atend_apac', 'apac_por_paciente', 'meses_autorizados', 'qtd_proc_apac']
  },
  {
    chave: 'sus_laudos', area: 'sus', titulo: 'SUS · Laudos e Autorizações', fonte: 'sus_laudo', icone: '✎',
    indicadores: ['qtd_laudos_sus', 'qtd_proc_solic', 'proc_por_laudo', 'qtd_atend_laudo']
  },
  {
    chave: 'repasse', area: 'sus', titulo: 'Repasse Médico (AIH)', fonte: 'repasse_medico', icone: '⇢',
    indicadores: ['valor_repasse_aih', 'qtd_aih_repasse', 'repasse_por_aih',
      'qtd_itens_repasse', 'repasse_medio_item']
  },

  // ── Suprimentos & Custos ──
  {
    chave: 'compras', area: 'suprimentos', titulo: 'Compras e Fornecedores', fonte: 'compras', icone: '⛬',
    indicadores: ['valor_compras', 'qtd_notas', 'ticket_nota', 'valor_descontos']
  },
  {
    chave: 'nutricao', area: 'suprimentos', titulo: 'Nutrição — Dietas', fonte: 'dieta', icone: '◔',
    indicadores: ['qtd_dietas', 'qtd_atend_dieta', 'dietas_por_atend', 'qtd_dieta_enteral', 'taxa_susp_dieta']
  },
  {
    chave: 'custo', area: 'suprimentos', resumo: true, titulo: 'Custo Assistencial de Material', fonte: 'custo_material', icone: '◆', pesado: true,
    indicadores: ['valor_material', 'qtd_itens_material', 'custo_por_atend', 'custo_medio_item']
  },
  {
    chave: 'farmacia', area: 'suprimentos', titulo: 'Farmácia (CPOE)', fonte: 'farmacia', icone: '℞', pesado: true,
    indicadores: ['qtd_prescricoes', 'qtd_pacientes', 'qtd_materiais', 'itens_por_paciente']
  },
  {
    chave: 'exames', area: 'suprimentos', titulo: 'Exames e Procedimentos Pedidos', fonte: 'cpoe_proc', icone: '⌕', pesado: true,
    indicadores: ['qtd_exames_presc', 'qtd_atend_exame', 'exames_por_atend', 'qtd_exames_susp', 'taxa_susp_exame']
  },
  {
    chave: 'prescricao', area: 'suprimentos', titulo: 'Prescrição Médica', fonte: 'prescricao', icone: '✑', pesado: true,
    indicadores: ['qtd_presc_med', 'qtd_atend_presc', 'presc_por_atend', 'taxa_susp_presc', 'qtd_prescritores']
  },

  // ── Apoio & Infra ──
  {
    chave: 'manutencao', area: 'apoio', titulo: 'Manutenção', fonte: 'manutencao', icone: '⚙',
    indicadores: ['qtd_os', 'qtd_os_concluidas', 'qtd_os_abertas', 'taxa_conclusao_os', 'tempo_medio_os']
  },

  // ── Resultado (fontes cruzadas) ──
  {
    chave: 'res_caixa', area: 'resultado', resumo: true, titulo: 'Faturado × Entrada em Caixa', fonte: 'caixa_vs_fatura', icone: '∆',
    indicadores: ['valor_faturado', 'valor_recebimento', 'pct_conversao_caixa', 'valor_glosado', 'glosa_sobre_caixa']
  },
  {
    chave: 'res_prod_conta', area: 'resultado', titulo: 'Produção × Conta Faturada', fonte: 'producao_vs_conta', icone: '≡',
    indicadores: ['valor_produzido', 'valor_contas', 'pct_prod_faturada', 'qtd_contas', 'ticket_conta']
  },
  {
    chave: 'res_margem', area: 'resultado', titulo: 'Margem Assistencial', fonte: 'resultado', icone: '◭', pesado: true,
    indicadores: ['valor_produzido', 'valor_material', 'margem_assistencial', 'pct_margem_assist', 'custo_sobre_prod']
  },
  {
    chave: 'res_custo_int', area: 'resultado', titulo: 'Custo por Internação', fonte: 'custo_internacao', icone: '◈', pesado: true,
    indicadores: ['custo_por_intern', 'custo_por_dia', 'qtd_internacoes', 'dias_permanencia', 'valor_material']
  }
];

const BLOCOS_POR_CHAVE = {};
BLOCOS.forEach(function (b) { BLOCOS_POR_CHAVE[b.chave] = b; });

// Um bloco é lido pelo mesmo caminho de uma dimensão, só sem GROUP BY:
// esta "dimensão fictícia" é o que faz o total de um bloco composto
// (duas fontes) sair pelo mesmo consultarTotalDimensao dos simples.
function dimDoBloco(bloco) {
  return { fonte: bloco.fonte, filtro: bloco.filtro, joins: bloco.joins, partes: {} };
}

// ═══════════════════════════════════════════════════════════════════
// SÉRIES DA EVOLUÇÃO CONSOLIDADA
// ═══════════════════════════════════════════════════════════════════
// Uma query mensal por fonte; séries que saem da mesma fonte
// reaproveitam a query, sem custar uma varredura a mais.
// Só fontes rápidas entram aqui: a evolução é a primeira coisa que a
// direção vê, e uma varredura pesada travaria o gráfico inteiro.
const SERIES = [
  { chave: 'valor_faturado', nome: 'Faturado', fonte: 'glosa_protocolo', indicador: 'valor_faturado' },
  { chave: 'valor_glosado', nome: 'Glosado', fonte: 'glosa_protocolo', indicador: 'valor_glosado' },
  { chave: 'valor_recebimento', nome: 'Recebido em caixa', fonte: 'recebimento', indicador: 'valor_recebimento' },
  { chave: 'valor_pago_retorno', nome: 'Pago pelo convênio', fonte: 'retorno_item', indicador: 'valor_pago_retorno' },
  { chave: 'valor_produzido', nome: 'Produção', fonte: 'producao', indicador: 'valor_produzido' },
  { chave: 'valor_aih', nome: 'Valor SUS (AIH)', fonte: 'sus_aih', indicador: 'valor_aih' },
  { chave: 'valor_repasse_aih', nome: 'Repasse médico', fonte: 'repasse_medico', indicador: 'valor_repasse_aih' },
  { chave: 'valor_compras', nome: 'Compras', fonte: 'compras', indicador: 'valor_compras' },
  { chave: 'qtd_atendimentos', nome: 'Atendimentos', fonte: 'atendimento', indicador: 'qtd_atendimentos' },
  { chave: 'qtd_internacoes', nome: 'Internações', fonte: 'atendimento', indicador: 'qtd_internacoes' },
  { chave: 'qtd_aih', nome: 'AIH emitidas', fonte: 'sus_aih', indicador: 'qtd_aih' },
  { chave: 'qtd_obitos', nome: 'Óbitos', fonte: 'atendimento', indicador: 'qtd_obitos' }
];

// ═══════════════════════════════════════════════════════════════════
// GET /api/geral/catalogo
// ═══════════════════════════════════════════════════════════════════
function obterCatalogo(req, res) {
  const catalogo = montarCatalogo();
  catalogo.blocos = BLOCOS.map(function (b) {
    return {
      chave: b.chave, titulo: b.titulo, icone: b.icone,
      area: b.area, resumo: !!b.resumo, pesado: !!FONTES[b.fonte].pesado,
      indicadores: b.indicadores
    };
  });
  catalogo.series = SERIES.map(function (s) {
    const cfg = INDICADORES[s.indicador];
    return { chave: s.chave, nome: s.nome, tipo: cfg.tipo, cor: cfg.cor };
  });
  // Dicionário como mapa plano: uma entrada por indicador (~21 KB), e não
  // uma cópia da descrição em cada uma das ~950 combinações do catálogo.
  catalogo.indicadores = dicionarioIndicadores();
  res.json(catalogo);
}

// ═══════════════════════════════════════════════════════════════════
// POST /api/geral — dados de uma dimensão
// ═══════════════════════════════════════════════════════════════════
// body: { dimensao, indicador, ordem, limite, tipoPeriodo, periodoValor,
//         comparar, drill }
//   comparar  true  → traz o mesmo recorte no período anterior e o delta
//   drill     texto → em vez da dimensão, devolve a evolução mensal
//                     daquele item específico
function buscarGeral(req, res) {
  const { dimensao, indicador, ordem, comparar, drill } = req.body;
  const dim = DIMENSOES[dimensao];

  if (!dim) {
    return res.status(400).json({ mensagem: 'Dimensão inválida: ' + dimensao });
  }

  const fonte = FONTES[dim.fonte];
  const indicadorAtivo = fonte.indicadores.indexOf(indicador) !== -1 ? indicador : fonte.indicadores[0];
  const periodo = resolverPeriodo(req.body);
  const limiteBruto = parseInt(req.body.limite, 10);
  const limite = isNaN(limiteBruto) || limiteBruto <= 0 ? 999 : limiteBruto;

  const emDrill = drill != null && String(drill) !== '';
  const evolucao = emDrill || !!dim.anoInteiro;

  // consultarDimensao esconde a diferença entre fonte simples (uma
  // query) e composta (uma query por parte, casadas pelo rótulo).
  const opcoes = {
    porMes: emDrill,
    filtrarItem: emDrill,
    extras: emDrill ? [String(drill)] : []
  };

  // Comparativo não se aplica a séries temporais: ali cada rótulo já é
  // um mês, e a comparação certa é a própria linha do gráfico.
  const querComparar = !!comparar && !evolucao;
  const anterior = querComparar ? periodoAnterior(periodo) : null;

  // Dimensão cortada por topSql traz só as N maiores linhas: somar essas
  // linhas daria um total menor que o real. Nesse caso o total sai de uma
  // agregação própria, sem GROUP BY, que enxerga a base inteira.
  const precisaTotalExato = !!dim.topSql && !emDrill;

  const consultas = [consultarDimensao(dim, req.usuario, periodo, opcoes)];
  if (querComparar) {
    consultas.push(consultarDimensao(dim, req.usuario, anterior, opcoes));
  }
  if (precisaTotalExato) {
    consultas.push(consultarTotalDimensao(dim, req.usuario, periodo));
    if (querComparar) consultas.push(consultarTotalDimensao(dim, req.usuario, anterior));
  }

  Promise.all(consultas).then(function (resultados) {
    const rows = resultados[0].rows;
    let dados = rows.map(function (row) { return montarLinha(fonte, row, indicadorAtivo); });

    if (querComparar) {
      const antesPorLabel = {};
      resultados[1].rows.forEach(function (row) {
        const chave = row.label == null || row.label === '' ? 'Não Informado' : String(row.label);
        antesPorLabel[chave] = fonte.montar(row);
      });

      dados.forEach(function (item) {
        const antes = antesPorLabel[item.label];
        fonte.indicadores.forEach(function (chave) {
          const valorAntes = antes ? (antes[chave] || 0) : 0;
          item[chave + '_ant'] = valorAntes;
          item[chave + '_ant_fmt'] = antes ? formatarValor(chave, valorAntes) : '—';
          item[chave + '_var'] = antes ? variacao(item[chave], valorAntes) : null;
        });
        item.novo = !antes;
        item.variacao = item[indicadorAtivo + '_var'];
        item.valorAnteriorFormatado = item[indicadorAtivo + '_ant_fmt'];
      });
    }

    if (dim.ordemFixa && !evolucao) {
      // Ordem de leitura declarada na dimensão (faixa etária, prioridade,
      // status): rótulo fora da lista vai para o fim, mantendo a ordem.
      const posicao = {};
      dim.ordemFixa.forEach(function (rotulo, i) { posicao[rotulo] = i; });
      dados.sort(function (a, b) {
        const pa = posicao[a.label] == null ? 999 : posicao[a.label];
        const pb = posicao[b.label] == null ? 999 : posicao[b.label];
        return pa - pb;
      });
    } else if (dim.ordemLabel || evolucao) {
      dados.sort(function (a, b) { return a.label < b.label ? -1 : a.label > b.label ? 1 : 0; });
    } else {
      dados.sort(function (a, b) {
        return ordem === 'asc' ? a.valorRaw - b.valorRaw : b.valorRaw - a.valorRaw;
      });
    }

    const totalBase = dados.length;
    const iTotal = querComparar ? 2 : 1;
    const linhasTotal = precisaTotalExato ? resultados[iTotal].rows : rows;
    const totais = montarTotais(fonte, linhasTotal);
    if (querComparar) {
      const linhasTotalAntes = precisaTotalExato ? resultados[iTotal + 1].rows : resultados[1].rows;
      const totaisAntes = consolidar(fonte, linhasTotalAntes);
      fonte.indicadores.forEach(function (chave) {
        totais[chave + '_ant'] = totaisAntes[chave] || 0;
        totais[chave + '_ant_fmt'] = formatarValor(chave, totaisAntes[chave]);
        totais[chave + '_var'] = variacao(totais[chave], totaisAntes[chave] || 0);
      });
    }

    dados = dados.slice(0, limite);

    const cfg = INDICADORES[indicadorAtivo];
    const origem = origemDadosDimensao(dim);
    res.json({
      dimensao: dimensao,
      nomeDimensao: emDrill ? dim.nome + ' · ' + drill : dim.nome,
      grupo: dim.grupo,
      evolucao: evolucao,
      drill: emDrill ? String(drill) : null,
      pesado: !!fonte.pesado,
      composta: !!fonte.partes,
      indicador: indicadorAtivo,
      nomeIndicador: cfg.nome,
      tipo: cfg.tipo,
      cor: cfg.cor,
      melhor: cfg.melhor,
      indicadores: indicadoresDaDimensao(dim),
      fontes: origem.tabelas,
      origemDados: origem,
      naoAditivos: fonte.naoAditivos || [],
      comparado: querComparar,
      periodo: {
        ano: periodo.anoRef,
        mes: evolucao ? null : periodo.mesRef,
        rotulo: evolucao ? periodo.anoRef : rotuloPeriodo(periodo),
        rotuloAnterior: anterior ? rotuloPeriodo(anterior) : null
      },
      totalBase: totalBase,
      truncado: precisaTotalExato,
      limiteFonte: dim.topSql || null,
      totais: totais,
      dados: dados
    });
  }).catch(function (error) {
    logger.error({ err: error }, 'Erro na query do painel geral (' + dimensao + ')');
    res.status(500).json({ mensagem: 'Erro ao consultar o painel geral: ' + error.message });
  });
}

// ═══════════════════════════════════════════════════════════════════
// POST /api/geral/resumo — KPIs de um bloco
// ═══════════════════════════════════════════════════════════════════
// body: { bloco?, comparar?, tipoPeriodo, periodoValor }
// Sem `bloco`, devolve todos os não pesados; o painel pede um por vez,
// em paralelo, para pintar cada cartão conforme chega.
function kpisDoBloco(bloco, valores, valoresAntes) {
  return bloco.indicadores.map(function (chave) {
    const cfg = INDICADORES[chave];
    const atual = valores[chave] || 0;
    const kpi = {
      chave: chave,
      nome: cfg.nome,
      tipo: cfg.tipo,
      cor: cfg.cor,
      melhor: cfg.melhor,
      valor: atual,
      valorFormatado: formatarValor(chave, atual)
    };
    if (valoresAntes) {
      const antes = valoresAntes[chave] || 0;
      kpi.valorAnterior = antes;
      kpi.valorAnteriorFormatado = formatarValor(chave, antes);
      kpi.variacao = variacao(atual, antes);
    }
    return kpi;
  });
}

function carregarBloco(bloco, usuario, periodo, anterior) {
  const fonte = FONTES[bloco.fonte];
  const dim = dimDoBloco(bloco);
  const origem = origemDadosDimensao(dim);
  const consultas = [consultarTotalDimensao(dim, usuario, periodo)];
  if (anterior) consultas.push(consultarTotalDimensao(dim, usuario, anterior));

  return Promise.all(consultas).then(function (r) {
    const valores = fonte.montar(r[0].rows[0] || {});
    const valoresAntes = anterior ? fonte.montar(r[1].rows[0] || {}) : null;
    return {
      chave: bloco.chave,
      titulo: bloco.titulo,
      icone: bloco.icone,
      area: bloco.area,
      resumo: !!bloco.resumo,
      pesado: !!fonte.pesado,
      composta: !!fonte.partes,
      kpis: kpisDoBloco(bloco, valores, valoresAntes),
      fontes: origem.tabelas,
      origemDados: origem
    };
  });
}

// body: { bloco? | area?, comparar?, pesados?, tipoPeriodo, periodoValor }
// O front pede um bloco por vez para pintar cada cartão conforme chega;
// `area` existe para a aba conseguir carregar o seu conjunto de uma vez
// (útil em script/integração), e sem nenhum dos dois volta o que a
// Visão Geral precisa — só os blocos marcados `resumo` e não pesados.
function alvosDoResumo(body) {
  if (body.bloco) {
    const b = BLOCOS_POR_CHAVE[body.bloco];
    return b ? [b] : null;
  }
  const incluirPesado = body.pesados === true;
  // A área 'geral' (Visão Geral) não tem blocos próprios: ela é o conjunto
  // dos marcados `resumo`, que vivem nas outras áreas.
  const daArea = body.area && body.area !== 'geral'
    ? BLOCOS.filter(function (b) { return b.area === body.area; })
    : BLOCOS.filter(function (b) { return b.resumo; });
  return daArea.filter(function (b) { return incluirPesado || !FONTES[b.fonte].pesado; });
}

function buscarResumo(req, res) {
  const periodo = resolverPeriodo(req.body);
  const anterior = req.body.comparar === false ? null : periodoAnterior(periodo);
  const alvos = alvosDoResumo(req.body);

  if (!alvos) {
    return res.status(400).json({ mensagem: 'Bloco inválido: ' + req.body.bloco });
  }

  Promise.all(alvos.map(function (b) { return carregarBloco(b, req.usuario, periodo, anterior); }))
    .then(function (blocos) {
      res.json({
        periodo: {
          ano: periodo.anoRef,
          mes: periodo.mesRef,
          rotulo: rotuloPeriodo(periodo),
          rotuloAnterior: anterior ? rotuloPeriodo(anterior) : null
        },
        blocos: blocos
      });
    })
    .catch(function (error) {
      logger.error({ err: error }, 'Erro no resumo do painel geral (' +
        (req.body.bloco || req.body.area || 'resumo') + ')');
      res.status(500).json({ mensagem: 'Erro ao montar o resumo: ' + error.message });
    });
}

// ═══════════════════════════════════════════════════════════════════
// POST /api/geral/evolucao — séries mensais consolidadas
// ═══════════════════════════════════════════════════════════════════
// Sempre o ano inteiro, mesmo com filtro de mês: a leitura da direção
// aqui é a tendência do ano, não a fatia do mês.
function buscarEvolucao(req, res) {
  const periodo = resolverPeriodo(req.body);

  const fontesUsadas = [];
  SERIES.forEach(function (s) {
    if (fontesUsadas.indexOf(s.fonte) === -1) fontesUsadas.push(s.fonte);
  });

  const consultas = fontesUsadas.map(function (id) {
    return executar(construirQueryMensal(FONTES[id]), id, req.usuario, periodo, true);
  });

  Promise.all(consultas).then(function (resultados) {
    const porFonte = {};
    fontesUsadas.forEach(function (id, i) {
      const fonte = FONTES[id];
      const mapa = {};
      resultados[i].rows.forEach(function (row) {
        if (row.mes) mapa[String(row.mes)] = fonte.montar(row);
      });
      porFonte[id] = mapa;
    });

    const eixo = {};
    fontesUsadas.forEach(function (id) {
      Object.keys(porFonte[id]).forEach(function (m) { eixo[m] = true; });
    });
    const meses = Object.keys(eixo).sort();

    const series = SERIES.map(function (s) {
      const mapa = porFonte[s.fonte];
      const cfg = INDICADORES[s.indicador];
      return {
        chave: s.chave,
        nome: s.nome,
        tipo: cfg.tipo,
        cor: cfg.cor,
        dados: meses.map(function (m) { return (mapa[m] || {})[s.indicador] || 0; }),
        formatados: meses.map(function (m) {
          return formatarValor(s.indicador, (mapa[m] || {})[s.indicador] || 0);
        }),
        fontes: fontesTabelas(s.fonte),
        origemDados: origemDadosFonte(s.fonte)
      };
    });

    res.json({ ano: periodo.anoRef, meses: meses, series: series });
  }).catch(function (error) {
    logger.error({ err: error }, 'Erro na evolução do painel geral');
    res.status(500).json({ mensagem: 'Erro ao montar a evolução: ' + error.message });
  });
}

// ═══════════════════════════════════════════════════════════════════
// POST /api/geral/tendencia — série mensal de UMA dimensão
// ═══════════════════════════════════════════════════════════════════
// body: { dimensao, indicador?, ano?, comparar? }
//
// A peça já existia e não era usada: consultarDimensao com
// { porMes: true, filtrarItem: false } agrupa a dimensão inteira por mês
// numa ÚNICA query, respeitando joins e filtro da dimensão. O `drill` do
// POST / não serve aqui porque ele amarra porMes a filtrarItem, ou seja,
// só sabe responder por um item de cada vez.
//
// Uma query, nunca doze: o ODS não tem índice de data em nenhuma tabela
// grande, então 12 pedidos seriam 12 varreduras completas — 6 a 8 minutos
// numa fonte pesada, sem nem aproveitar o cache (12 corpos = 12 chaves).
// `comparar` é o ano anterior e custa uma segunda varredura, por isso o
// front só manda quando a pessoa pede.
//
// Sempre o ano inteiro, como a evolução consolidada: filtro de mês ou dia
// da tela não se aplica — o que se quer aqui é a curva do ano.
function buscarTendencia(req, res) {
  const { dimensao, indicador, comparar } = req.body;
  const dim = DIMENSOES[dimensao];

  if (!dim) {
    return res.status(400).json({ mensagem: 'Dimensão inválida: ' + dimensao });
  }

  const fonte = FONTES[dim.fonte];
  const indicadorAtivo = fonte.indicadores.indexOf(indicador) !== -1 ? indicador : fonte.indicadores[0];
  const ano = parseInt(req.body.ano, 10) || new Date().getFullYear();
  const opcoes = { porMes: true, filtrarItem: false, extras: [] };

  const consultas = [consultarDimensao(dim, req.usuario, periodoDoAno(ano, null), opcoes)];
  if (comparar) consultas.push(consultarDimensao(dim, req.usuario, periodoDoAno(ano - 1, null), opcoes));

  Promise.all(consultas).then(function (resultados) {
    function porMes(r) {
      return r.rows
        .map(function (row) { return montarLinha(fonte, row, indicadorAtivo); })
        .sort(function (a, b) { return a.label < b.label ? -1 : a.label > b.label ? 1 : 0; });
    }

    const dados = porMes(resultados[0]);
    const cfg = INDICADORES[indicadorAtivo];
    const origem = origemDadosDimensao(dim);

    res.json({
      dimensao: dimensao,
      nomeDimensao: dim.nome,
      grupo: dim.grupo,
      ano: ano,
      indicador: indicadorAtivo,
      nomeIndicador: cfg.nome,
      tipo: cfg.tipo,
      cor: cfg.cor,
      melhor: cfg.melhor,
      indicadores: indicadoresDaDimensao(dim),
      pesado: !!fonte.pesado,
      composta: !!fonte.partes,
      fontes: origem.tabelas,
      origemDados: origem,
      naoAditivos: fonte.naoAditivos || [],
      totais: montarTotais(fonte, resultados[0].rows),
      dados: dados,
      // Ano anterior alinhado pelo mês (MM), para o gráfico sobrepor as
      // duas curvas sem depender do ano no rótulo.
      anterior: comparar ? { ano: ano - 1, dados: porMes(resultados[1]) } : null
    });
  }).catch(function (error) {
    logger.error({ err: error }, 'Erro na tendência do painel geral (' + dimensao + ')');
    res.status(500).json({ mensagem: 'Erro ao montar a tendência: ' + error.message });
  });
}

module.exports = {
  obterCatalogo,
  buscarGeral,
  buscarResumo,
  buscarEvolucao,
  buscarTendencia,
  AREAS,
  BLOCOS,
  SERIES,
  DIMENSOES,
  FONTES,
  INDICADORES,
  montarCatalogo,
  construirQuery,
  metaIndicador
};
