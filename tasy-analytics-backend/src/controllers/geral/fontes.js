const { intervaloAno } = require('../../utils/periodo');

// ═══════════════════════════════════════════════════════════════════
// PAINEL GERAL — FONTES DE DADOS
// ═══════════════════════════════════════════════════════════════════
// Uma fonte = uma tabela-base do ODS + as métricas que ela sabe somar.
// Toda dimensão aponta para uma fonte, e é a fonte que decide QUAIS
// indicadores existem naquela dimensão — por isso a lista de
// indicadores do painel muda conforme a dimensão selecionada.
//
// Contrato de cada fonte:
//   tabelaEscopo   alias usado por services/escopoAcesso.js
//   from           cláusula FROM com o alias
//   joinsBase      joins necessários para as MÉTRICAS (não para o label)
//   where          filtro de período, sempre com $1 e $2
//   params()       [$1, $2] a partir do período resolvido
//   metricas       colunas agregadas cruas (nada de derivado aqui)
//   montar(row)    converte a linha crua nos indicadores, já com os derivados
//   indicadores    ordem em que aparecem no painel; o 1º é o padrão
//   naoAditivos    indicadores que não podem ser somados entre grupos
//   mesLabel       expressão de mês, usada no drill-down de evolução
//   pesado         true = varredura de tabela grande (avisa na tela)
//
// IMPORTANTE: nenhuma query é escrita à mão; todas são montadas por
// construirQuery() em consulta.js, que injeta o marcador /* ESCOPO */.

function num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function divisao(a, b) { return b > 0 ? a / b : 0; }
function pct(a, b) { return b > 0 ? (a / b) * 100 : 0; }

// Janela meia-aberta [inicio, fimExclusivo). Meia-aberta e não "<= dataFim"
// porque as colunas de data do ODS são timestamp: comparar com a data crua
// do último dia descartaria tudo que aconteceu depois de 00:00 nele.
function proximoDia(dataIso) {
  const d = new Date(dataIso + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function janelaData(periodo, anoInteiro) {
  if (anoInteiro || !periodo.dataInicio || !periodo.dataFim) return intervaloAno(periodo.anoRef);
  return { inicio: periodo.dataInicio, fimExclusivo: proximoDia(periodo.dataFim) };
}

// Fontes com coluna de data usam sempre o mesmo par de parâmetros.
function paramsData(periodo, anoInteiro) {
  const j = janelaData(periodo, anoInteiro);
  return [j.inicio, j.fimExclusivo];
}

// Fontes de glosa são particionadas por ano_ref/mes_ref (texto), não por data.
function paramsRef(periodo, anoInteiro) {
  return [periodo.anoRef, anoInteiro ? null : periodo.mesRef];
}

const ESTABELECIMENTO = (coluna) => `COALESCE(
    CASE ${coluna}
      WHEN 1 THEN 'Hospital de Caridade São Vicente de Paulo'
      WHEN 6 THEN 'Centro Oncológico Hospital São Vicente'
      ELSE 'Estabelecimento ' || CAST(${coluna} AS TEXT)
    END, 'Não Informado')`;

const FONTES = {
  // ─────────────────────────────────────────────────────────────
  // Protocolos de glosa — visão financeira consolidada
  // ─────────────────────────────────────────────────────────────
  glosa_protocolo: {
    tabelaEscopo: 'gp',
    from: 'FROM ods.glosas_protocolos gp',
    where: 'gp.ano_ref = $1 AND ($2::text IS NULL OR gp.mes_ref = $2)',
    params: paramsRef,
    mesLabel: `gp.ano_ref || '-' || gp.mes_ref`,
    metricaPrincipal: 'SUM(gp.vl_protocolo)',
    having: 'HAVING SUM(gp.vl_protocolo) > 0',
    metricas: `
      COALESCE(SUM(gp.vl_protocolo), 0)     as valor_faturado,
      COALESCE(SUM(gp.vl_pago), 0)          as valor_recebido,
      COALESCE(SUM(gp.vl_glosado), 0)       as valor_glosado,
      COALESCE(SUM(gp.vl_aceito), 0)        as valor_glosa_aceita,
      COALESCE(SUM(gp.vl_reapresentado), 0) as valor_reapresentado,
      COALESCE(SUM(gp.vl_adicional), 0)     as valor_adicional,
      COALESCE(SUM(gp.vl_retorno), 0)       as valor_retorno,
      COUNT(*)                              as qtd_protocolos`,
    indicadores: ['valor_faturado', 'valor_recebido', 'valor_glosado', 'pct_glosado', 'pct_recebido',
      'valor_a_receber', 'valor_glosa_aceita', 'pct_glosa_aceita', 'valor_reapresentado',
      'valor_adicional', 'pct_adicional', 'valor_retorno', 'qtd_protocolos', 'ticket_protocolo'],
    naoAditivos: [],
    montar: function (row) {
      const i = {
        valor_faturado: num(row.valor_faturado),
        valor_recebido: num(row.valor_recebido),
        valor_glosado: num(row.valor_glosado),
        valor_glosa_aceita: num(row.valor_glosa_aceita),
        valor_reapresentado: num(row.valor_reapresentado),
        valor_adicional: num(row.valor_adicional),
        valor_retorno: num(row.valor_retorno),
        qtd_protocolos: num(row.qtd_protocolos)
      };
      i.valor_a_receber = Math.max(0, i.valor_faturado - i.valor_recebido - i.valor_glosa_aceita);
      i.pct_recebido = pct(i.valor_recebido, i.valor_faturado);
      i.pct_glosado = pct(i.valor_glosado, i.valor_faturado);
      i.pct_glosa_aceita = pct(i.valor_glosa_aceita, i.valor_faturado);
      i.pct_adicional = pct(i.valor_adicional, i.valor_faturado);
      i.ticket_protocolo = divisao(i.valor_faturado, i.qtd_protocolos);
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Glosa item a item — motivo, setor e prescritor
  // ─────────────────────────────────────────────────────────────
  glosa_item: {
    tabelaEscopo: 'gi',
    from: 'FROM ods.glosas_por_item gi',
    where: 'gi.ano_ref = $1 AND ($2::text IS NULL OR gi.mes_ref = $2)',
    params: paramsRef,
    mesLabel: `gi.ano_ref || '-' || gi.mes_ref`,
    metricaPrincipal: 'SUM(gi.vl_glosa)',
    having: 'HAVING SUM(gi.vl_item) > 0 OR SUM(gi.vl_glosa) > 0',
    metricas: `
      COALESCE(SUM(gi.vl_glosa), 0)     as valor_glosado,
      COALESCE(SUM(gi.vl_item), 0)      as valor_item,
      COALESCE(SUM(gi.vl_pago), 0)      as valor_recebido,
      COUNT(DISTINCT gi.nr_atendimento) as qtd_atend_glosa`,
    indicadores: ['valor_glosado', 'pct_glosado', 'valor_item', 'valor_recebido', 'qtd_atend_glosa', 'glosa_por_atend'],
    naoAditivos: ['qtd_atend_glosa', 'glosa_por_atend'],
    montar: function (row) {
      const i = {
        valor_item: num(row.valor_item),
        valor_glosado: num(row.valor_glosado),
        valor_recebido: num(row.valor_recebido),
        qtd_atend_glosa: num(row.qtd_atend_glosa)
      };
      i.pct_glosado = pct(i.valor_glosado, i.valor_item);
      i.glosa_por_atend = divisao(i.valor_glosado, i.qtd_atend_glosa);
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Produção médica — atende produção geral, cirúrgica e de fisio
  // (o recorte vem do `filtro` da dimensão, não da fonte)
  // ─────────────────────────────────────────────────────────────
  producao: {
    tabelaEscopo: 'pp',
    from: 'FROM ods.procedimento_paciente pp',
    where: 'pp.dt_procedimento >= $1 AND pp.dt_procedimento < $2',
    params: paramsData,
    mesLabel: `TO_CHAR(pp.dt_procedimento, 'YYYY-MM')`,
    metricaPrincipal: 'COUNT(*)',
    having: 'HAVING COUNT(*) > 0',
    metricas: `
      COUNT(*)                              as qtd_procedimentos,
      COUNT(DISTINCT pp.nr_atendimento)     as qtd_atendimentos,
      COALESCE(SUM(pp.vl_procedimento), 0)  as valor_produzido,
      COALESCE(SUM(pp.vl_medico), 0)        as valor_medico`,
    indicadores: ['valor_produzido', 'qtd_procedimentos', 'qtd_atendimentos', 'valor_medico',
      'ticket_atendimento', 'valor_medio_proc', 'proc_por_atend', 'pct_repasse'],
    naoAditivos: ['qtd_atendimentos', 'ticket_atendimento', 'proc_por_atend'],
    montar: function (row) {
      const i = {
        qtd_atendimentos: num(row.qtd_atendimentos),
        qtd_procedimentos: num(row.qtd_procedimentos),
        valor_produzido: num(row.valor_produzido),
        valor_medico: num(row.valor_medico)
      };
      i.ticket_atendimento = divisao(i.valor_produzido, i.qtd_atendimentos);
      i.valor_medio_proc = divisao(i.valor_produzido, i.qtd_procedimentos);
      i.proc_por_atend = divisao(i.qtd_procedimentos, i.qtd_atendimentos);
      i.pct_repasse = pct(i.valor_medico, i.valor_produzido);
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Contas do paciente — faturamento e dias faturados
  // ─────────────────────────────────────────────────────────────
  conta: {
    tabelaEscopo: 'cp',
    from: 'FROM ods.conta_paciente cp',
    where: `cp.dt_mesano_referencia >= $1 AND cp.dt_mesano_referencia < $2
      AND (cp.ie_cancelamento IS NULL OR cp.ie_cancelamento = 'N')`,
    params: paramsData,
    mesLabel: `TO_CHAR(cp.dt_mesano_referencia, 'YYYY-MM')`,
    metricaPrincipal: 'COUNT(DISTINCT cp.nr_interno_conta)',
    having: 'HAVING COUNT(DISTINCT cp.nr_interno_conta) > 0',
    metricas: `
      COUNT(DISTINCT cp.nr_interno_conta) as qtd_contas,
      COALESCE(SUM(cp.vl_conta), 0)       as valor_contas,
      COALESCE(SUM(cp.qt_dias_conta), 0)  as dias_permanencia`,
    indicadores: ['valor_contas', 'qtd_contas', 'ticket_conta', 'dias_permanencia', 'media_permanencia'],
    naoAditivos: [],
    montar: function (row) {
      const i = {
        qtd_contas: num(row.qtd_contas),
        dias_permanencia: num(row.dias_permanencia),
        valor_contas: num(row.valor_contas)
      };
      i.media_permanencia = divisao(i.dias_permanencia, i.qtd_contas);
      i.ticket_conta = divisao(i.valor_contas, i.qtd_contas);
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Prescrição de materiais/medicamentos (CPOE)
  // ─────────────────────────────────────────────────────────────
  farmacia: {
    tabelaEscopo: 'cm',
    from: 'FROM ods.cpoe_material cm',
    where: `cm.dt_liberacao >= $1 AND cm.dt_liberacao < $2 AND cm.ie_item_valido = 'S'`,
    params: paramsData,
    mesLabel: `TO_CHAR(cm.dt_liberacao, 'YYYY-MM')`,
    metricaPrincipal: 'COUNT(*)',
    having: 'HAVING COUNT(*) > 0',
    pesado: true,
    metricas: `
      COUNT(*)                          as qtd_prescricoes,
      COUNT(DISTINCT cm.nr_atendimento) as qtd_pacientes,
      COUNT(DISTINCT cm.cd_material)    as qtd_materiais`,
    indicadores: ['qtd_prescricoes', 'qtd_pacientes', 'qtd_materiais', 'itens_por_paciente'],
    naoAditivos: ['qtd_pacientes', 'qtd_materiais', 'itens_por_paciente'],
    montar: function (row) {
      const i = {
        qtd_prescricoes: num(row.qtd_prescricoes),
        qtd_pacientes: num(row.qtd_pacientes),
        qtd_materiais: num(row.qtd_materiais)
      };
      i.itens_por_paciente = divisao(i.qtd_prescricoes, i.qtd_pacientes);
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Atendimentos e desfechos (ods.atendimento_paciente)
  // Traz o que nenhum painel de área cobria: volume real de
  // atendimentos, internações, óbitos, urgência e permanência.
  // motivo_alta e pessoa_fisica entram como joinsBase porque as
  // MÉTRICAS dependem deles (óbito e idade), não só o rótulo.
  // ─────────────────────────────────────────────────────────────
  atendimento: {
    tabelaEscopo: 'ap',
    from: 'FROM ods.atendimento_paciente ap',
    joinsBase: `LEFT JOIN ods.motivo_alta ma ON ma.cd_motivo_alta = ap.cd_motivo_alta
      LEFT JOIN ods.pessoa_fisica pfp ON pfp.cd_pessoa_fisica = ap.cd_pessoa_fisica`,
    where: 'ap.dt_entrada >= $1 AND ap.dt_entrada < $2',
    params: paramsData,
    mesLabel: `TO_CHAR(ap.dt_entrada, 'YYYY-MM')`,
    metricaPrincipal: 'COUNT(*)',
    having: 'HAVING COUNT(*) > 0',
    metricas: `
      COUNT(*)                                                             as qtd_atendimentos,
      COUNT(DISTINCT ap.cd_pessoa_fisica)                                  as qtd_pacientes,
      COUNT(*) FILTER (WHERE ap.ie_tipo_atendimento = 1)                   as qtd_internacoes,
      COUNT(*) FILTER (WHERE ap.dt_alta IS NOT NULL)                       as qtd_altas,
      COUNT(*) FILTER (WHERE ma.ie_obito = 'S')                            as qtd_obitos,
      COUNT(*) FILTER (WHERE ap.ie_carater_inter_sus = '02')               as qtd_urgencia,
      COALESCE(SUM(EXTRACT(EPOCH FROM (ap.dt_alta - ap.dt_entrada)) / 86400)
               FILTER (WHERE ap.dt_alta IS NOT NULL), 0)                   as soma_dias,
      COALESCE(SUM(EXTRACT(EPOCH FROM (ap.dt_alta - ap.dt_entrada)) / 86400)
               FILTER (WHERE ap.dt_alta IS NOT NULL AND ap.ie_tipo_atendimento = 1), 0) as soma_dias_intern,
      COUNT(*) FILTER (WHERE ap.dt_alta IS NOT NULL AND ap.ie_tipo_atendimento = 1)     as qtd_intern_alta,
      COALESCE(SUM(EXTRACT(YEAR FROM AGE(ap.dt_entrada, pfp.dt_nascimento)))
               FILTER (WHERE pfp.dt_nascimento IS NOT NULL), 0)            as soma_idade,
      COUNT(*) FILTER (WHERE pfp.dt_nascimento IS NOT NULL)                as qtd_com_idade`,
    indicadores: ['qtd_atendimentos', 'qtd_pacientes', 'qtd_internacoes', 'permanencia_intern',
      'qtd_obitos', 'taxa_obito', 'qtd_urgencia', 'taxa_urgencia', 'qtd_altas',
      'permanencia_media', 'idade_media', 'atend_por_paciente'],
    naoAditivos: ['qtd_pacientes', 'atend_por_paciente'],
    montar: function (row) {
      const i = {
        qtd_atendimentos: num(row.qtd_atendimentos),
        qtd_pacientes: num(row.qtd_pacientes),
        qtd_internacoes: num(row.qtd_internacoes),
        qtd_altas: num(row.qtd_altas),
        qtd_obitos: num(row.qtd_obitos),
        qtd_urgencia: num(row.qtd_urgencia)
      };
      // Óbito é medido sobre as SAÍDAS (altas), não sobre as entradas:
      // atendimento em curso ainda não tem desfecho.
      i.taxa_obito = pct(i.qtd_obitos, i.qtd_altas);
      i.taxa_urgencia = pct(i.qtd_urgencia, i.qtd_atendimentos);
      // "Estadia" cobre todo tipo de atendimento (a maioria é ambulatorial,
      // de horas); "Permanência (Internação)" é a métrica que a direção
      // acompanha — só ie_tipo_atendimento = 1, sobre as internações com alta.
      i.permanencia_media = divisao(num(row.soma_dias), i.qtd_altas);
      i.permanencia_intern = divisao(num(row.soma_dias_intern), num(row.qtd_intern_alta));
      i.idade_media = divisao(num(row.soma_idade), num(row.qtd_com_idade));
      i.atend_por_paciente = divisao(i.qtd_atendimentos, i.qtd_pacientes);
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Ocupação por unidade (ods.atend_paciente_unidade)
  // Passagem de paciente por setor/leito — giro e permanência real
  // por unidade, que a conta de faturamento não mostra.
  // ─────────────────────────────────────────────────────────────
  unidade: {
    tabelaEscopo: 'apu',
    from: 'FROM ods.atend_paciente_unidade apu',
    where: 'apu.dt_entrada_unidade >= $1 AND apu.dt_entrada_unidade < $2',
    params: paramsData,
    mesLabel: `TO_CHAR(apu.dt_entrada_unidade, 'YYYY-MM')`,
    metricaPrincipal: 'COUNT(*)',
    having: 'HAVING COUNT(*) > 0',
    metricas: `
      COUNT(*)                                                     as qtd_passagens,
      COUNT(DISTINCT apu.nr_atendimento)                           as qtd_atendimentos,
      COUNT(*) FILTER (WHERE apu.dt_saida_unidade IS NULL)         as qtd_em_aberto,
      COALESCE(SUM(EXTRACT(EPOCH FROM (apu.dt_saida_unidade - apu.dt_entrada_unidade)) / 86400)
               FILTER (WHERE apu.dt_saida_unidade IS NOT NULL), 0) as dias_ocupacao,
      COUNT(*) FILTER (WHERE apu.dt_saida_unidade IS NOT NULL)     as qtd_encerradas`,
    indicadores: ['qtd_passagens', 'dias_ocupacao', 'permanencia_unidade', 'qtd_atendimentos', 'qtd_em_aberto'],
    naoAditivos: ['qtd_atendimentos'],
    montar: function (row) {
      const i = {
        qtd_passagens: num(row.qtd_passagens),
        qtd_atendimentos: num(row.qtd_atendimentos),
        qtd_em_aberto: num(row.qtd_em_aberto),
        dias_ocupacao: num(row.dias_ocupacao)
      };
      i.permanencia_unidade = divisao(i.dias_ocupacao, num(row.qtd_encerradas));
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Custo assistencial de material (ods.material_atend_paciente)
  // 12,5 milhões de linhas / 3,4 GB e sem índice de data no ODS:
  // qualquer recorte varre a tabela inteira (~40s). Fica de fora do
  // resumo executivo e é marcada como pesada para o painel avisar.
  // ─────────────────────────────────────────────────────────────
  custo_material: {
    tabelaEscopo: 'map',
    from: 'FROM ods.material_atend_paciente map',
    where: 'map.dt_atendimento >= $1 AND map.dt_atendimento < $2',
    params: paramsData,
    mesLabel: `TO_CHAR(map.dt_atendimento, 'YYYY-MM')`,
    metricaPrincipal: 'SUM(map.vl_material)',
    having: 'HAVING COUNT(*) > 0',
    pesado: true,
    metricas: `
      COALESCE(SUM(map.vl_material), 0)  as valor_material,
      COUNT(*)                           as qtd_itens_material,
      COALESCE(SUM(map.qt_material), 0)  as qtd_unidades,
      COUNT(DISTINCT map.nr_atendimento) as qtd_atendimentos`,
    indicadores: ['valor_material', 'qtd_itens_material', 'qtd_unidades', 'qtd_atendimentos',
      'custo_por_atend', 'custo_medio_item'],
    naoAditivos: ['qtd_atendimentos', 'custo_por_atend'],
    montar: function (row) {
      const i = {
        valor_material: num(row.valor_material),
        qtd_itens_material: num(row.qtd_itens_material),
        qtd_unidades: num(row.qtd_unidades),
        qtd_atendimentos: num(row.qtd_atendimentos)
      };
      i.custo_por_atend = divisao(i.valor_material, i.qtd_atendimentos);
      i.custo_medio_item = divisao(i.valor_material, i.qtd_itens_material);
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Compras / notas fiscais de entrada (ods.nota_fiscal)
  // ie_situacao = '1' (ativa): as situações 2 e 3 são a mesma nota
  // repetida no ODS (mesmos totais), contá-las duplicaria a despesa.
  // ─────────────────────────────────────────────────────────────
  compras: {
    tabelaEscopo: 'nf',
    from: 'FROM ods.nota_fiscal nf',
    where: `nf.dt_emissao >= $1 AND nf.dt_emissao < $2 AND nf.ie_situacao = '1'`,
    params: paramsData,
    mesLabel: `TO_CHAR(nf.dt_emissao, 'YYYY-MM')`,
    metricaPrincipal: 'SUM(nf.vl_total_nota)',
    having: 'HAVING COUNT(*) > 0',
    metricas: `
      COALESCE(SUM(nf.vl_total_nota), 0) as valor_compras,
      COALESCE(SUM(nf.vl_mercadoria), 0) as valor_mercadoria,
      COALESCE(SUM(nf.vl_frete), 0)      as valor_frete,
      COALESCE(SUM(nf.vl_descontos), 0)  as valor_descontos,
      COALESCE(SUM(nf.vl_ipi), 0)        as valor_ipi,
      COUNT(*)                           as qtd_notas`,
    indicadores: ['valor_compras', 'qtd_notas', 'ticket_nota', 'valor_mercadoria',
      'valor_descontos', 'valor_frete', 'valor_ipi'],
    naoAditivos: [],
    montar: function (row) {
      const i = {
        valor_compras: num(row.valor_compras),
        valor_mercadoria: num(row.valor_mercadoria),
        valor_frete: num(row.valor_frete),
        valor_descontos: num(row.valor_descontos),
        valor_ipi: num(row.valor_ipi),
        qtd_notas: num(row.qtd_notas)
      };
      i.ticket_nota = divisao(i.valor_compras, i.qtd_notas);
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Recebimentos de convênio (ods.convenio_receb) — caixa de fato,
  // diferente do "valor pago" que aparece no protocolo de glosa.
  // ─────────────────────────────────────────────────────────────
  recebimento: {
    tabelaEscopo: 'cvr',
    from: 'FROM ods.convenio_receb cvr',
    where: 'cvr.dt_recebimento >= $1 AND cvr.dt_recebimento < $2',
    params: paramsData,
    mesLabel: `TO_CHAR(cvr.dt_recebimento, 'YYYY-MM')`,
    metricaPrincipal: 'SUM(cvr.vl_recebimento)',
    having: 'HAVING COUNT(*) > 0',
    metricas: `
      COALESCE(SUM(cvr.vl_recebimento), 0)     as valor_recebimento,
      COALESCE(SUM(cvr.vl_despesa_bancaria), 0) as despesa_bancaria,
      COUNT(*)                                  as qtd_recebimentos`,
    indicadores: ['valor_recebimento', 'qtd_recebimentos', 'ticket_recebimento', 'despesa_bancaria'],
    naoAditivos: [],
    montar: function (row) {
      const i = {
        valor_recebimento: num(row.valor_recebimento),
        despesa_bancaria: num(row.despesa_bancaria),
        qtd_recebimentos: num(row.qtd_recebimentos)
      };
      i.ticket_recebimento = divisao(i.valor_recebimento, i.qtd_recebimentos);
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Ordens de serviço / manutenção (ods.man_ordem_servico)
  // ie_status_ordem = '3' é a OS encerrada (cadastro do Tasy).
  // ─────────────────────────────────────────────────────────────
  manutencao: {
    tabelaEscopo: 'mos',
    from: 'FROM ods.man_ordem_servico mos',
    where: 'mos.dt_ordem_servico >= $1 AND mos.dt_ordem_servico < $2',
    params: paramsData,
    mesLabel: `TO_CHAR(mos.dt_ordem_servico, 'YYYY-MM')`,
    metricaPrincipal: 'COUNT(*)',
    having: 'HAVING COUNT(*) > 0',
    metricas: `
      COUNT(*)                                                    as qtd_os,
      COUNT(*) FILTER (WHERE mos.ie_status_ordem = '3')           as qtd_os_concluidas,
      COUNT(*) FILTER (WHERE mos.ie_status_ordem IS DISTINCT FROM '3') as qtd_os_abertas,
      COALESCE(SUM(EXTRACT(EPOCH FROM (mos.dt_fim_real - mos.dt_ordem_servico)) / 3600)
               FILTER (WHERE mos.dt_fim_real IS NOT NULL), 0)     as soma_horas,
      COUNT(*) FILTER (WHERE mos.dt_fim_real IS NOT NULL)         as qtd_com_fim`,
    indicadores: ['qtd_os', 'qtd_os_concluidas', 'qtd_os_abertas', 'taxa_conclusao_os', 'tempo_medio_os'],
    naoAditivos: [],
    montar: function (row) {
      const i = {
        qtd_os: num(row.qtd_os),
        qtd_os_concluidas: num(row.qtd_os_concluidas),
        qtd_os_abertas: num(row.qtd_os_abertas)
      };
      i.taxa_conclusao_os = pct(i.qtd_os_concluidas, i.qtd_os);
      i.tempo_medio_os = divisao(num(row.soma_horas), num(row.qtd_com_fim));
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Retorno de convênio, item a item (ods.convenio_retorno_item)
  // É o demonstrativo de pagamento: o que o convênio EFETIVAMENTE
  // pagou, glosou e pagou a menor. Complementa glosa_protocolo, que
  // só mostra o lado da cobrança. Datado por dt_pagamento.
  // vl_juros, vl_coparticipacao, vl_desconto e vl_perdas vêm zerados
  // ou nulos no ODS desta casa — não entram como indicador.
  // ─────────────────────────────────────────────────────────────
  retorno_item: {
    tabelaEscopo: 'cri',
    from: 'FROM ods.convenio_retorno_item cri',
    where: 'cri.dt_pagamento >= $1 AND cri.dt_pagamento < $2',
    params: paramsData,
    mesLabel: `TO_CHAR(cri.dt_pagamento, 'YYYY-MM')`,
    metricaPrincipal: 'SUM(cri.vl_pago)',
    having: 'HAVING COUNT(*) > 0',
    metricas: `
      COALESCE(SUM(cri.vl_pago), 0)        as valor_pago_retorno,
      COALESCE(SUM(cri.vl_glosado), 0)     as valor_glosado,
      COALESCE(SUM(cri.vl_adicional), 0)   as valor_adicional,
      COALESCE(SUM(cri.vl_amenor), 0)      as valor_amenor,
      COALESCE(SUM(cri.vl_guia), 0)        as valor_guia_retorno,
      COUNT(*)                             as qtd_itens_retorno,
      COUNT(DISTINCT cri.nr_interno_conta) as qtd_contas_retorno`,
    indicadores: ['valor_pago_retorno', 'valor_glosado', 'pct_glosa_retorno', 'valor_amenor',
      'valor_adicional', 'valor_guia_retorno', 'qtd_itens_retorno', 'qtd_contas_retorno',
      'ticket_item_retorno'],
    naoAditivos: ['qtd_contas_retorno'],
    montar: function (row) {
      const i = {
        valor_pago_retorno: num(row.valor_pago_retorno),
        valor_glosado: num(row.valor_glosado),
        valor_adicional: num(row.valor_adicional),
        valor_amenor: num(row.valor_amenor),
        valor_guia_retorno: num(row.valor_guia_retorno),
        qtd_itens_retorno: num(row.qtd_itens_retorno),
        qtd_contas_retorno: num(row.qtd_contas_retorno)
      };
      i.pct_glosa_retorno = pct(i.valor_glosado, i.valor_guia_retorno);
      i.ticket_item_retorno = divisao(i.valor_pago_retorno, i.qtd_itens_retorno);
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Repasse de honorário médico em AIH (ods.v_aih_repasse_medico)
  // Materialized view já desnormalizada (traz ds_procedimento e
  // ds_convenio prontos), 1,2 mi de linhas e ~0,2s por consulta — a
  // fonte mais barata do painel.
  //
  // NÃO há corte por médico aqui, de propósito: cd_medico_executor está
  // preenchido em 2.689 das 316.752 linhas de 2025 (0,8%), e o dinheiro
  // está justamente nas linhas sem médico — em junho, R$ 507.101 dos
  // R$ 507.251 cairiam em "Não Informado". Uma dimensão assim não é
  // dado, é ruído. ds_convenio e mc_ac vêm em 100% das linhas e
  // ds_procedimento em 78%: é por esses três que a fonte é cortada.
  // ─────────────────────────────────────────────────────────────
  repasse_medico: {
    tabelaEscopo: 'vrm',
    from: 'FROM ods.v_aih_repasse_medico vrm',
    where: 'vrm.dt_mesano_referencia >= $1 AND vrm.dt_mesano_referencia < $2',
    params: paramsData,
    mesLabel: `TO_CHAR(vrm.dt_mesano_referencia, 'YYYY-MM')`,
    metricaPrincipal: 'SUM(vrm.repasse)',
    having: 'HAVING COUNT(*) > 0',
    metricas: `
      COALESCE(SUM(vrm.repasse), 0)             as valor_repasse_aih,
      COUNT(*)                                  as qtd_itens_repasse,
      COUNT(DISTINCT vrm.nr_aih)                as qtd_aih_repasse`,
    indicadores: ['valor_repasse_aih', 'qtd_aih_repasse', 'repasse_por_aih',
      'qtd_itens_repasse', 'repasse_medio_item'],
    naoAditivos: ['qtd_aih_repasse'],
    montar: function (row) {
      const i = {
        valor_repasse_aih: num(row.valor_repasse_aih),
        qtd_itens_repasse: num(row.qtd_itens_repasse),
        qtd_aih_repasse: num(row.qtd_aih_repasse)
      };
      i.repasse_medio_item = divisao(i.valor_repasse_aih, i.qtd_itens_repasse);
      i.repasse_por_aih = divisao(i.valor_repasse_aih, i.qtd_aih_repasse);
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Guias de faturamento (ods.conta_paciente_guia)
  // vl_participante (coparticipação) vem zerado no ODS desta casa.
  // Não puxamos convênio daqui: exigiria join com conta_paciente
  // (947 mil linhas) e a fonte deixaria de responder em ~1s.
  // ─────────────────────────────────────────────────────────────
  guia: {
    tabelaEscopo: 'cpg',
    from: 'FROM ods.conta_paciente_guia cpg',
    where: 'cpg.dt_acerto_conta >= $1 AND cpg.dt_acerto_conta < $2',
    params: paramsData,
    mesLabel: `TO_CHAR(cpg.dt_acerto_conta, 'YYYY-MM')`,
    metricaPrincipal: 'SUM(cpg.vl_guia)',
    having: 'HAVING COUNT(*) > 0',
    metricas: `
      COUNT(*)                             as qtd_guias,
      COALESCE(SUM(cpg.vl_guia), 0)        as valor_guias,
      COALESCE(SUM(cpg.vl_convenio), 0)    as valor_guia_convenio,
      COUNT(DISTINCT cpg.nr_interno_conta) as qtd_contas_guia`,
    indicadores: ['valor_guias', 'qtd_guias', 'ticket_guia', 'valor_guia_convenio',
      'qtd_contas_guia', 'guias_por_conta'],
    naoAditivos: ['qtd_contas_guia', 'guias_por_conta'],
    montar: function (row) {
      const i = {
        qtd_guias: num(row.qtd_guias),
        valor_guias: num(row.valor_guias),
        valor_guia_convenio: num(row.valor_guia_convenio),
        qtd_contas_guia: num(row.qtd_contas_guia)
      };
      i.ticket_guia = divisao(i.valor_guias, i.qtd_guias);
      i.guias_por_conta = divisao(i.qtd_guias, i.qtd_contas_guia);
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Lotes contábeis (ods.lote_contabil)
  // Movimento contábil bruto do período — em 2025, R$ 1,91 bi de
  // débito contra R$ 1,91 bi de crédito. O saldo próximo de zero é o
  // esperado (partidas dobradas); o que interessa à direção é o
  // volume por tipo de lote e o desequilíbrio quando aparece.
  // ─────────────────────────────────────────────────────────────
  contabil: {
    tabelaEscopo: 'lc',
    from: 'FROM ods.lote_contabil lc',
    where: 'lc.dt_referencia >= $1 AND lc.dt_referencia < $2',
    params: paramsData,
    mesLabel: `TO_CHAR(lc.dt_referencia, 'YYYY-MM')`,
    metricaPrincipal: 'SUM(lc.vl_debito)',
    having: 'HAVING COUNT(*) > 0',
    metricas: `
      COALESCE(SUM(lc.vl_debito), 0)  as valor_debito,
      COALESCE(SUM(lc.vl_credito), 0) as valor_credito,
      COUNT(*)                        as qtd_lotes`,
    indicadores: ['valor_debito', 'valor_credito', 'saldo_contabil', 'qtd_lotes'],
    naoAditivos: [],
    montar: function (row) {
      const i = {
        valor_debito: num(row.valor_debito),
        valor_credito: num(row.valor_credito),
        qtd_lotes: num(row.qtd_lotes)
      };
      i.saldo_contabil = i.valor_credito - i.valor_debito;
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Protocolos enviados ao convênio (ods.protocolo_convenio)
  // Cobre TODOS os protocolos, não só os que voltaram com glosa.
  //
  // O que a base sustenta e o que não sustenta (medido em 2025, 3.808
  // protocolos): ie_status_protocolo preenchido em 100% (3.744 fechados),
  // dt_vencimento em 67% — esses viram indicador. dt_envio existe em
  // 4,6% e dt_retorno e vl_recebimento em 0%: um "% enviado" saindo em
  // 3% diria que o faturamento não envia protocolo, quando o que falta
  // é o registro da data. Preferimos não ter o KPI a ter um errado.
  // ─────────────────────────────────────────────────────────────
  protocolo: {
    tabelaEscopo: 'pc',
    from: 'FROM ods.protocolo_convenio pc',
    where: 'pc.dt_mesano_referencia >= $1 AND pc.dt_mesano_referencia < $2',
    params: paramsData,
    mesLabel: `TO_CHAR(pc.dt_mesano_referencia, 'YYYY-MM')`,
    metricaPrincipal: 'COUNT(*)',
    having: 'HAVING COUNT(*) > 0',
    metricas: `
      COUNT(*)                                                       as qtd_protocolos_conv,
      COUNT(*) FILTER (WHERE CAST(pc.ie_status_protocolo AS TEXT) = '2') as qtd_prot_fechados,
      COUNT(*) FILTER (WHERE CAST(pc.ie_status_protocolo AS TEXT) <> '2'
                          OR pc.ie_status_protocolo IS NULL)         as qtd_prot_abertos,
      COUNT(pc.dt_vencimento)                                        as qtd_prot_com_venc,
      COUNT(*) FILTER (WHERE pc.dt_vencimento < CURRENT_DATE
                         AND CAST(pc.ie_status_protocolo AS TEXT) <> '2') as qtd_prot_vencidos`,
    indicadores: ['qtd_protocolos_conv', 'qtd_prot_fechados', 'pct_prot_fechado',
      'qtd_prot_abertos', 'qtd_prot_vencidos', 'qtd_prot_com_venc'],
    naoAditivos: [],
    montar: function (row) {
      const i = {
        qtd_protocolos_conv: num(row.qtd_protocolos_conv),
        qtd_prot_fechados: num(row.qtd_prot_fechados),
        qtd_prot_abertos: num(row.qtd_prot_abertos),
        qtd_prot_com_venc: num(row.qtd_prot_com_venc),
        qtd_prot_vencidos: num(row.qtd_prot_vencidos)
      };
      i.pct_prot_fechado = pct(i.qtd_prot_fechados, i.qtd_protocolos_conv);
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // SUS · AIH de internação (ods.sus_aih_unif)
  // Primeira fonte de SUS do painel. qt_saida_alta/transferencia/obito
  // são flags 0/1 por AIH, então somá-las dá a contagem de desfechos —
  // e a taxa de óbito sai sobre as SAÍDAS, não sobre as emissões.
  // ─────────────────────────────────────────────────────────────
  sus_aih: {
    tabelaEscopo: 'sa',
    from: 'FROM ods.sus_aih_unif sa',
    where: 'sa.dt_emissao >= $1 AND sa.dt_emissao < $2',
    params: paramsData,
    mesLabel: `TO_CHAR(sa.dt_emissao, 'YYYY-MM')`,
    metricaPrincipal: 'COUNT(*)',
    having: 'HAVING COUNT(*) > 0',
    // qt_permanencia_real só existe em 10,5% das AIH de 2025 (1.661 de
    // 15.845). Dividir a soma pelo total daria 0,54 dia de "permanência
    // média" numa base de internação — número absurdo produzido pelo
    // preenchimento, não pelo hospital. A média sai sobre as AIH que TÊM
    // o campo (dá 5,16 dias, plausível) e `qtd_aih_com_perm` fica ao lado
    // como indicador, para a base do cálculo ficar visível na tela.
    metricas: `
      COUNT(*)                                     as qtd_aih,
      COALESCE(SUM(sa.vl_tot_sp), 0)               as valor_aih,
      COALESCE(SUM(sa.qt_permanencia_real), 0)     as dias_perm_sus,
      COUNT(*) FILTER (WHERE sa.qt_permanencia_real > 0) as qtd_aih_com_perm,
      COALESCE(SUM(sa.qt_saida_obito), 0)          as qtd_obitos_sus,
      COALESCE(SUM(sa.qt_saida_alta), 0)           as qtd_altas_sus,
      COALESCE(SUM(sa.qt_saida_transferencia), 0)  as qtd_transf_sus,
      COALESCE(SUM(sa.qt_nascido_vivo), 0)         as qtd_nasc_vivos,
      COALESCE(SUM(sa.qt_nascido_morto), 0)        as qtd_nasc_mortos,
      COALESCE(SUM(sa.qt_longa_permanencia), 0)    as qtd_longa_perm,
      COUNT(DISTINCT sa.nr_atendimento)            as qtd_atend_aih`,
    indicadores: ['qtd_aih', 'valor_aih', 'ticket_aih', 'perm_media_aih', 'qtd_aih_com_perm',
      'dias_perm_sus', 'qtd_obitos_sus', 'taxa_obito_sus', 'qtd_altas_sus', 'qtd_transf_sus',
      'qtd_longa_perm', 'qtd_nasc_vivos', 'qtd_nasc_mortos', 'qtd_atend_aih'],
    naoAditivos: ['qtd_atend_aih'],
    montar: function (row) {
      const i = {
        qtd_aih: num(row.qtd_aih),
        valor_aih: num(row.valor_aih),
        dias_perm_sus: num(row.dias_perm_sus),
        qtd_aih_com_perm: num(row.qtd_aih_com_perm),
        qtd_obitos_sus: num(row.qtd_obitos_sus),
        qtd_altas_sus: num(row.qtd_altas_sus),
        qtd_transf_sus: num(row.qtd_transf_sus),
        qtd_nasc_vivos: num(row.qtd_nasc_vivos),
        qtd_nasc_mortos: num(row.qtd_nasc_mortos),
        qtd_longa_perm: num(row.qtd_longa_perm),
        qtd_atend_aih: num(row.qtd_atend_aih)
      };
      const saidas = i.qtd_altas_sus + i.qtd_transf_sus + i.qtd_obitos_sus;
      i.ticket_aih = divisao(i.valor_aih, i.qtd_aih);
      i.perm_media_aih = divisao(i.dias_perm_sus, i.qtd_aih_com_perm);
      i.taxa_obito_sus = pct(i.qtd_obitos_sus, saidas);
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // SUS · APAC ambulatorial (ods.sus_apac_unif)
  // Alta complexidade ambulatorial — oncologia, diálise, bariátrica.
  // A tabela não guarda valor, só autorização e quantidade de meses.
  // ─────────────────────────────────────────────────────────────
  sus_apac: {
    tabelaEscopo: 'sap',
    from: 'FROM ods.sus_apac_unif sap',
    where: 'sap.dt_competencia >= $1 AND sap.dt_competencia < $2',
    params: paramsData,
    mesLabel: `TO_CHAR(sap.dt_competencia, 'YYYY-MM')`,
    metricaPrincipal: 'COUNT(*)',
    having: 'HAVING COUNT(*) > 0',
    metricas: `
      COUNT(*)                                    as qtd_apac,
      COUNT(DISTINCT sap.nr_atendimento)          as qtd_atend_apac,
      COUNT(DISTINCT sap.cd_procedimento)         as qtd_proc_apac,
      COALESCE(SUM(sap.qt_meses_autorizados), 0)  as meses_autorizados`,
    indicadores: ['qtd_apac', 'qtd_atend_apac', 'apac_por_paciente', 'meses_autorizados', 'qtd_proc_apac'],
    naoAditivos: ['qtd_atend_apac', 'qtd_proc_apac', 'apac_por_paciente'],
    montar: function (row) {
      const i = {
        qtd_apac: num(row.qtd_apac),
        qtd_atend_apac: num(row.qtd_atend_apac),
        qtd_proc_apac: num(row.qtd_proc_apac),
        meses_autorizados: num(row.meses_autorizados)
      };
      i.apac_por_paciente = divisao(i.qtd_apac, i.qtd_atend_apac);
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // SUS · Laudos e autorizações (ods.sus_laudo_paciente)
  // O pedido antes da AIH/APAC: o que foi solicitado ao gestor e em
  // que situação o processo está.
  // ─────────────────────────────────────────────────────────────
  sus_laudo: {
    tabelaEscopo: 'slp',
    from: 'FROM ods.sus_laudo_paciente slp',
    where: 'slp.dt_emissao >= $1 AND slp.dt_emissao < $2',
    params: paramsData,
    mesLabel: `TO_CHAR(slp.dt_emissao, 'YYYY-MM')`,
    metricaPrincipal: 'COUNT(*)',
    having: 'HAVING COUNT(*) > 0',
    metricas: `
      COUNT(*)                                      as qtd_laudos_sus,
      COALESCE(SUM(slp.qt_procedimento_solic), 0)   as qtd_proc_solic,
      COUNT(DISTINCT slp.nr_atendimento)            as qtd_atend_laudo`,
    indicadores: ['qtd_laudos_sus', 'qtd_proc_solic', 'proc_por_laudo', 'qtd_atend_laudo'],
    naoAditivos: ['qtd_atend_laudo'],
    montar: function (row) {
      const i = {
        qtd_laudos_sus: num(row.qtd_laudos_sus),
        qtd_proc_solic: num(row.qtd_proc_solic),
        qtd_atend_laudo: num(row.qtd_atend_laudo)
      };
      i.proc_por_laudo = divisao(i.qtd_proc_solic, i.qtd_laudos_sus);
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Laudos por atendimento (ods.laudo_por_atendimento)
  // Tabela minúscula e a única com CID já ligado ao atendimento —
  // é por ela que a direção vê o perfil de diagnóstico da casa.
  // ─────────────────────────────────────────────────────────────
  laudo: {
    tabelaEscopo: 'lpa',
    from: 'FROM ods.laudo_por_atendimento lpa',
    where: 'lpa.dt_emissao_laudo >= $1 AND lpa.dt_emissao_laudo < $2',
    params: paramsData,
    mesLabel: `TO_CHAR(lpa.dt_emissao_laudo, 'YYYY-MM')`,
    metricaPrincipal: 'SUM(lpa.qt_laudos)',
    having: 'HAVING COUNT(*) > 0',
    metricas: `
      COALESCE(SUM(lpa.qt_laudos), 0)     as qtd_laudos,
      COUNT(DISTINCT lpa.nr_atendimento)  as qtd_atend_laudo`,
    indicadores: ['qtd_laudos', 'qtd_atend_laudo', 'laudos_por_atend'],
    naoAditivos: ['qtd_atend_laudo', 'laudos_por_atend'],
    montar: function (row) {
      const i = {
        qtd_laudos: num(row.qtd_laudos),
        qtd_atend_laudo: num(row.qtd_atend_laudo)
      };
      i.laudos_por_atend = divisao(i.qtd_laudos, i.qtd_atend_laudo);
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Exames e procedimentos prescritos (ods.cpoe_procedimento)
  // 1,7 mi de linhas / 1 GB sem índice de data: ~6s por consulta,
  // por isso `pesado`. Mede a DEMANDA (o que foi pedido), enquanto
  // procedimento_paciente mede o que foi executado e faturado.
  // ─────────────────────────────────────────────────────────────
  cpoe_proc: {
    tabelaEscopo: 'cpp',
    from: 'FROM ods.cpoe_procedimento cpp',
    where: `cpp.dt_liberacao >= $1 AND cpp.dt_liberacao < $2 AND cpp.ie_item_valido = 'S'`,
    params: paramsData,
    mesLabel: `TO_CHAR(cpp.dt_liberacao, 'YYYY-MM')`,
    metricaPrincipal: 'COUNT(*)',
    having: 'HAVING COUNT(*) > 0',
    pesado: true,
    // ie_urgencia não é usado nesta base (0 marcações em 488 mil linhas de
    // 2025), então não há indicador de urgência aqui — KPI que só mostra
    // zero atrapalha a leitura.
    metricas: `
      COUNT(*)                                                   as qtd_exames_presc,
      COALESCE(SUM(cpp.qt_procedimento), 0)                      as qtd_unid_exame,
      COUNT(DISTINCT cpp.nr_atendimento)                         as qtd_atend_exame,
      COUNT(*) FILTER (WHERE cpp.dt_suspensao IS NOT NULL)       as qtd_exames_susp`,
    indicadores: ['qtd_exames_presc', 'qtd_atend_exame', 'exames_por_atend', 'qtd_unid_exame',
      'qtd_exames_susp', 'taxa_susp_exame'],
    naoAditivos: ['qtd_atend_exame', 'exames_por_atend'],
    montar: function (row) {
      const i = {
        qtd_exames_presc: num(row.qtd_exames_presc),
        qtd_unid_exame: num(row.qtd_unid_exame),
        qtd_atend_exame: num(row.qtd_atend_exame),
        qtd_exames_susp: num(row.qtd_exames_susp)
      };
      i.exames_por_atend = divisao(i.qtd_exames_presc, i.qtd_atend_exame);
      i.taxa_susp_exame = pct(i.qtd_exames_susp, i.qtd_exames_presc);
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Nutrição — dietas prescritas (ods.cpoe_dieta)
  // ─────────────────────────────────────────────────────────────
  dieta: {
    tabelaEscopo: 'cdi',
    from: 'FROM ods.cpoe_dieta cdi',
    where: `cdi.dt_liberacao >= $1 AND cdi.dt_liberacao < $2 AND cdi.ie_item_valido = 'S'`,
    params: paramsData,
    mesLabel: `TO_CHAR(cdi.dt_liberacao, 'YYYY-MM')`,
    metricaPrincipal: 'COUNT(*)',
    having: 'HAVING COUNT(*) > 0',
    metricas: `
      COUNT(*)                                                as qtd_dietas,
      COUNT(DISTINCT cdi.nr_atendimento)                      as qtd_atend_dieta,
      COUNT(*) FILTER (WHERE cdi.ie_dieta_enteral = 'S')      as qtd_dieta_enteral,
      COUNT(*) FILTER (WHERE cdi.dt_suspensao IS NOT NULL)    as qtd_dietas_susp`,
    indicadores: ['qtd_dietas', 'qtd_atend_dieta', 'dietas_por_atend', 'qtd_dieta_enteral',
      'qtd_dietas_susp', 'taxa_susp_dieta'],
    naoAditivos: ['qtd_atend_dieta', 'dietas_por_atend'],
    montar: function (row) {
      const i = {
        qtd_dietas: num(row.qtd_dietas),
        qtd_atend_dieta: num(row.qtd_atend_dieta),
        qtd_dieta_enteral: num(row.qtd_dieta_enteral),
        qtd_dietas_susp: num(row.qtd_dietas_susp)
      };
      i.dietas_por_atend = divisao(i.qtd_dietas, i.qtd_atend_dieta);
      i.taxa_susp_dieta = pct(i.qtd_dietas_susp, i.qtd_dietas);
      return i;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Prescrição médica — base legado (ods.prescr_medica)
  // 3,6 mi de linhas / 574 MB, ~6s: `pesado`. Convive com o CPOE
  // (fonte `farmacia`); as duas somadas dão o volume real de
  // prescrição, mas NÃO devem ser somadas entre si sem cuidado —
  // parte do período tem os dois sistemas em uso.
  // ─────────────────────────────────────────────────────────────
  prescricao: {
    tabelaEscopo: 'pm',
    from: 'FROM ods.prescr_medica pm',
    where: 'pm.dt_prescricao >= $1 AND pm.dt_prescricao < $2',
    params: paramsData,
    mesLabel: `TO_CHAR(pm.dt_prescricao, 'YYYY-MM')`,
    metricaPrincipal: 'COUNT(*)',
    having: 'HAVING COUNT(*) > 0',
    pesado: true,
    // ie_emergencia nunca vale 'S' nesta base (836.336 'N' e 84.741 nulos em
    // 2025), então não há indicador nem corte de urgência aqui — mesma
    // decisão que em cpoe_proc.
    metricas: `
      COUNT(*)                                                as qtd_presc_med,
      COUNT(DISTINCT pm.nr_atendimento)                       as qtd_atend_presc,
      COUNT(*) FILTER (WHERE pm.dt_suspensao IS NOT NULL)     as qtd_presc_susp,
      COUNT(DISTINCT pm.cd_prescritor)                        as qtd_prescritores`,
    indicadores: ['qtd_presc_med', 'qtd_atend_presc', 'presc_por_atend', 'qtd_presc_susp',
      'taxa_susp_presc', 'qtd_prescritores'],
    naoAditivos: ['qtd_atend_presc', 'qtd_prescritores', 'presc_por_atend'],
    montar: function (row) {
      const i = {
        qtd_presc_med: num(row.qtd_presc_med),
        qtd_atend_presc: num(row.qtd_atend_presc),
        qtd_presc_susp: num(row.qtd_presc_susp),
        qtd_prescritores: num(row.qtd_prescritores)
      };
      i.presc_por_atend = divisao(i.qtd_presc_med, i.qtd_atend_presc);
      i.taxa_susp_presc = pct(i.qtd_presc_susp, i.qtd_presc_med);
      return i;
    }
  },

  // ═════════════════════════════════════════════════════════════
  // FONTES COMPOSTAS — indicadores que cruzam duas tabelas
  // ═════════════════════════════════════════════════════════════
  // Uma fonte composta não tem `from`/`where`/`metricas` próprios: ela
  // declara `partes`, e cada parte é consultada NA SUA PRÓPRIA tabela,
  // com o seu próprio período e escopo. As linhas voltam casadas pelo
  // RÓTULO (convênio "Unimed" de um lado com "Unimed" do outro), e o
  // `montar()` recebe as colunas cruas das duas, prefixadas.
  //
  // Por que casar por rótulo e não por join SQL: as tabelas envolvidas
  // têm 3,4 GB e nenhum índice de data — um join direto entre duas
  // varreduras completas não termina em tempo de tela. Casar em memória
  // custa duas queries independentes que já rodam em paralelo.
  //
  // O que isso NÃO garante: rótulo que existe num lado e não no outro
  // entra com zero do lado ausente (por isso a tela marca a linha como
  // "novo" no comparativo). Só declare dimensão composta onde os dois
  // lados de fato falam do mesmo universo — convênio, estabelecimento e
  // mês são seguros; setor, por exemplo, só onde as duas tabelas
  // apontam para ods.setor_atendimento.
  resultado: {
    partes: [
      { fonte: 'producao', prefixo: 'a_' },
      { fonte: 'custo_material', prefixo: 'b_' }
    ],
    indicadores: ['margem_assistencial', 'pct_margem_assist', 'valor_produzido', 'valor_material',
      'custo_sobre_prod', 'qtd_procedimentos', 'qtd_itens_material'],
    naoAditivos: [],
    montar: function (row) {
      const i = {
        valor_produzido: num(row.a_valor_produzido),
        qtd_procedimentos: num(row.a_qtd_procedimentos),
        valor_material: num(row.b_valor_material),
        qtd_itens_material: num(row.b_qtd_itens_material)
      };
      i.margem_assistencial = i.valor_produzido - i.valor_material;
      i.pct_margem_assist = pct(i.margem_assistencial, i.valor_produzido);
      i.custo_sobre_prod = pct(i.valor_material, i.valor_produzido);
      return i;
    }
  },

  caixa_vs_fatura: {
    partes: [
      { fonte: 'glosa_protocolo', prefixo: 'a_' },
      { fonte: 'recebimento', prefixo: 'b_' }
    ],
    indicadores: ['valor_faturado', 'valor_recebimento', 'pct_conversao_caixa', 'valor_glosado',
      'glosa_sobre_caixa', 'qtd_protocolos', 'qtd_recebimentos'],
    naoAditivos: [],
    montar: function (row) {
      const i = {
        valor_faturado: num(row.a_valor_faturado),
        valor_glosado: num(row.a_valor_glosado),
        qtd_protocolos: num(row.a_qtd_protocolos),
        valor_recebimento: num(row.b_valor_recebimento),
        qtd_recebimentos: num(row.b_qtd_recebimentos)
      };
      i.pct_conversao_caixa = pct(i.valor_recebimento, i.valor_faturado);
      i.glosa_sobre_caixa = pct(i.valor_glosado, i.valor_recebimento);
      return i;
    }
  },

  // ods.material_atend_paciente não tem cd_estabelecimento, então este
  // cruzamento só fecha por mês — é o custo de material por internação
  // ao longo do ano, não por unidade de negócio.
  custo_internacao: {
    partes: [
      { fonte: 'atendimento', prefixo: 'a_' },
      { fonte: 'custo_material', prefixo: 'b_' }
    ],
    indicadores: ['custo_por_intern', 'custo_por_dia', 'valor_material', 'qtd_internacoes',
      'dias_permanencia', 'qtd_atendimentos'],
    naoAditivos: ['qtd_atendimentos'],
    montar: function (row) {
      const i = {
        qtd_internacoes: num(row.a_qtd_internacoes),
        qtd_atendimentos: num(row.a_qtd_atendimentos),
        dias_permanencia: num(row.a_soma_dias_intern),
        valor_material: num(row.b_valor_material)
      };
      i.custo_por_intern = divisao(i.valor_material, i.qtd_internacoes);
      i.custo_por_dia = divisao(i.valor_material, i.dias_permanencia);
      return i;
    }
  },

  // Custo de material contra ocupação de leito. As duas tabelas apontam
  // para ods.setor_atendimento, então o rótulo de setor casa dos dois
  // lados — é o único cruzamento do painel que fecha por setor.
  custo_ocupacao: {
    partes: [
      { fonte: 'unidade', prefixo: 'a_' },
      { fonte: 'custo_material', prefixo: 'b_' }
    ],
    indicadores: ['custo_por_dia', 'valor_material', 'dias_ocupacao', 'qtd_passagens',
      'qtd_itens_material'],
    naoAditivos: [],
    montar: function (row) {
      const i = {
        qtd_passagens: num(row.a_qtd_passagens),
        dias_ocupacao: num(row.a_dias_ocupacao),
        valor_material: num(row.b_valor_material),
        qtd_itens_material: num(row.b_qtd_itens_material)
      };
      i.custo_por_dia = divisao(i.valor_material, i.dias_ocupacao);
      return i;
    }
  },

  producao_vs_conta: {
    partes: [
      { fonte: 'producao', prefixo: 'a_' },
      { fonte: 'conta', prefixo: 'b_' }
    ],
    indicadores: ['valor_produzido', 'valor_contas', 'pct_prod_faturada', 'qtd_contas',
      'ticket_conta', 'qtd_procedimentos'],
    naoAditivos: [],
    montar: function (row) {
      const i = {
        valor_produzido: num(row.a_valor_produzido),
        qtd_procedimentos: num(row.a_qtd_procedimentos),
        valor_contas: num(row.b_valor_contas),
        qtd_contas: num(row.b_qtd_contas)
      };
      i.pct_prod_faturada = pct(i.valor_contas, i.valor_produzido);
      i.ticket_conta = divisao(i.valor_contas, i.qtd_contas);
      return i;
    }
  }
};

// Uma fonte composta herda "pesado" de qualquer parte pesada: quem
// avisa a tela é este campo, e a varredura mais lenta é que manda.
Object.keys(FONTES).forEach(function (id) {
  const f = FONTES[id];
  if (!f.partes) return;
  f.pesado = f.partes.some(function (p) { return !!FONTES[p.fonte].pesado; });
});

function ehComposta(fonte) { return !!(fonte && fonte.partes); }

module.exports = { FONTES, ESTABELECIMENTO, janelaData, num, divisao, pct, ehComposta };
