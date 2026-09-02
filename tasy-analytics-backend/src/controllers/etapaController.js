const pool = require('../config/database');
const { extrairPeriodo, obterLimite, intervaloAno } = require('../utils/periodo');
const { aplicarEscopo } = require('../services/escopoAcesso');
const { extrairMetadadosSql } = require('../utils/extrairFontes');
const logger = require('../config/logger');

const DIMENSOES_ETAPA = {
  convenio: {
    query: `
      SELECT
        COALESCE(c.ds_convenio, 'Não Informado') as label,
        COUNT(DISTINCT cp.nr_interno_conta) as qtd_contas,
        COALESCE(SUM(cp.qt_dias_conta), 0) as dias_etapa,
        COALESCE(SUM(cp.vl_conta), 0) as vl_conta
      FROM ods.conta_paciente cp
      LEFT JOIN ods.convenio c ON cp.cd_convenio_parametro = c.cd_convenio
      WHERE cp.dt_mesano_referencia >= $1 AND cp.dt_mesano_referencia <= $2 /* ESCOPO */
        AND (cp.ie_cancelamento IS NULL OR cp.ie_cancelamento = 'N')
      GROUP BY c.ds_convenio
      HAVING COUNT(DISTINCT cp.nr_interno_conta) > 0
    `
  },
  estabelecimento: {
    // ods.conta_paciente só tem o código (cd_estabelecimento); não existe
    // tabela de estabelecimentos no schema. O nome descritivo vem
    // denormalizado em ods.glosas_protocolos — mapeado aqui diretamente
    // pois só há 2 estabelecimentos cadastrados no sistema.
    query: `
      SELECT
        COALESCE(
          CASE cp.cd_estabelecimento
            WHEN 1 THEN 'Hospital de Caridade São Vicente de Paulo'
            WHEN 6 THEN 'Centro Oncológico Hospital de Caridade São Vicente'
            ELSE 'Estabelecimento ' || CAST(cp.cd_estabelecimento AS TEXT)
          END,
          'Não Informado'
        ) as label,
        COUNT(DISTINCT cp.nr_interno_conta) as qtd_contas,
        COALESCE(SUM(cp.qt_dias_conta), 0) as dias_etapa,
        COALESCE(SUM(cp.vl_conta), 0) as vl_conta
      FROM ods.conta_paciente cp
      WHERE cp.dt_mesano_referencia >= $1 AND cp.dt_mesano_referencia <= $2 /* ESCOPO */
        AND (cp.ie_cancelamento IS NULL OR cp.ie_cancelamento = 'N')
      GROUP BY cp.cd_estabelecimento
      HAVING COUNT(DISTINCT cp.nr_interno_conta) > 0
    `
  },
  motivo_devolucao: {
    query: `
      SELECT
        COALESCE(gi.ds_motivo_glosa, 'Não Informado') as label,
        COUNT(DISTINCT gi.nr_atendimento) as qtd_contas,
        COALESCE(SUM(gi.vl_glosa), 0) as valor_glosa
      FROM ods.glosas_por_item gi
      WHERE gi.ano_ref = $1 AND ($2::text IS NULL OR gi.mes_ref = $2) /* ESCOPO */
        AND gi.ds_motivo_glosa IS NOT NULL
      GROUP BY gi.ds_motivo_glosa
      HAVING COUNT(DISTINCT gi.nr_atendimento) > 0
    `
  },
  mes: {
    query: `
      SELECT
        TO_CHAR(cp.dt_mesano_referencia, 'YYYY-MM') as label,
        COUNT(DISTINCT cp.nr_interno_conta) as qtd_contas,
        COALESCE(SUM(cp.qt_dias_conta), 0) as dias_etapa,
        COALESCE(SUM(cp.vl_conta), 0) as vl_conta
      FROM ods.conta_paciente cp
      WHERE cp.dt_mesano_referencia >= $1 AND cp.dt_mesano_referencia < $2 /* ESCOPO */
        AND (cp.ie_cancelamento IS NULL OR cp.ie_cancelamento = 'N')
      GROUP BY TO_CHAR(cp.dt_mesano_referencia, 'YYYY-MM')
      ORDER BY label
    `
  }
};

const NOMES_DIMENSAO = {
  convenio: 'Convênio',
  estabelecimento: 'Estabelecimento',
  motivo_devolucao: 'Motivo Devolução',
  mes: 'Mês'
};

const CONFIG_INDICADORES = {
  qtd_contas: { nome: 'Qtde Contas', isMoeda: false, isPercentual: false, isDecimal: false, color: '#475569', badgeClass: 'badge-qtd-contas' },
  dias_etapa: { nome: 'Dias Etapa', isMoeda: false, isPercentual: false, isDecimal: false, color: '#7c3aed', badgeClass: 'badge-dias-etapa' },
  media_etapa: { nome: 'Média Etapa', isMoeda: false, isPercentual: false, isDecimal: true, color: '#059669', badgeClass: 'badge-media-etapa' },
  vl_conta: { nome: 'Valor Conta', isMoeda: true, isPercentual: false, isDecimal: false, color: '#0284c7', badgeClass: 'badge-vl-conta' }
};

// Coluna (mesma expressão usada como "label" na dimensão de origem) usada
// para filtrar a evolução mensal quando o drill-down parte de uma linha
// específica da tabela. "motivo_devolucao" vem de outra tabela (gi), por
// isso tem query própria em vez de reaproveitar a de cp.
const COLUNA_FILTRO_MES_CP = {
  convenio: "COALESCE(c.ds_convenio, 'Não Informado')",
  estabelecimento: `COALESCE(
    CASE cp.cd_estabelecimento
      WHEN 1 THEN 'Hospital de Caridade São Vicente de Paulo'
      WHEN 6 THEN 'Centro Oncológico Hospital de Caridade São Vicente'
      ELSE 'Estabelecimento ' || CAST(cp.cd_estabelecimento AS TEXT)
    END,
    'Não Informado'
  )`
};

function construirQueryMesFiltradaCP(colunaFiltro) {
  return `
    SELECT
      TO_CHAR(cp.dt_mesano_referencia, 'YYYY-MM') as label,
      COUNT(DISTINCT cp.nr_interno_conta) as qtd_contas,
      COALESCE(SUM(cp.qt_dias_conta), 0) as dias_etapa,
      COALESCE(SUM(cp.vl_conta), 0) as vl_conta
    FROM ods.conta_paciente cp
    LEFT JOIN ods.convenio c ON cp.cd_convenio_parametro = c.cd_convenio
    WHERE cp.dt_mesano_referencia >= $1 AND cp.dt_mesano_referencia < $2 AND ${colunaFiltro} = $3 /* ESCOPO */
      AND (cp.ie_cancelamento IS NULL OR cp.ie_cancelamento = 'N')
    GROUP BY TO_CHAR(cp.dt_mesano_referencia, 'YYYY-MM')
    ORDER BY label
  `;
}

const QUERY_MES_FILTRADA_MOTIVO = `
  SELECT
    gi.mes_ref as label,
    COUNT(DISTINCT gi.nr_atendimento) as qtd_contas,
    0 as dias_etapa,
    COALESCE(SUM(gi.vl_glosa), 0) as vl_conta
  FROM ods.glosas_por_item gi
  WHERE gi.ano_ref = $1 AND COALESCE(gi.ds_motivo_glosa, 'Não Informado') = $2 /* ESCOPO */
    AND gi.ds_motivo_glosa IS NOT NULL
  GROUP BY gi.mes_ref
  ORDER BY gi.mes_ref
`;

function formatarNumero(v) { return Math.round(v || 0).toLocaleString('pt-BR'); }
function formatarDecimal(v) { return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }); }
function formatarMoeda(v) { return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }); }

function formatarItemMultivariado(item) {
  item.qtd_contas_fmt = formatarNumero(item.qtd_contas);
  item.dias_etapa_fmt = formatarNumero(item.dias_etapa);
  item.media_etapa_fmt = formatarDecimal(item.media_etapa);
  item.vl_conta_fmt = formatarMoeda(item.vl_conta);
  return item;
}

function buscarEtapa(req, res) {
  try {
    const { dimensao, indicador, ordem, dimensaoOrigem, rotulo } = req.body;
    const periodo = extrairPeriodo(req.body);
    const limite = obterLimite(req.body);

    if (!DIMENSOES_ETAPA[dimensao]) {
      return res.status(400).json({ mensagem: 'Dimensão inválida: ' + dimensao });
    }

    // Drill-down de uma linha específica: evolução mensal filtrada pelo
    // item clicado, não o indicador inteiro.
    const filtrarPorMotivo = dimensao === 'mes' && dimensaoOrigem === 'motivo_devolucao' && rotulo != null && rotulo !== '';
    const colunaFiltroCP = dimensao === 'mes' ? COLUNA_FILTRO_MES_CP[dimensaoOrigem] : null;
    const filtrarPorCP = !!colunaFiltroCP && rotulo != null && rotulo !== '';

    let config, params, tabelaEscopo;
    if (filtrarPorMotivo) {
      config = { query: QUERY_MES_FILTRADA_MOTIVO };
      params = [periodo.anoRef, rotulo];
      tabelaEscopo = 'gi';
    } else if (filtrarPorCP) {
      const intervaloCP = intervaloAno(periodo.anoRef);
      config = { query: construirQueryMesFiltradaCP(colunaFiltroCP) };
      params = [intervaloCP.inicio, intervaloCP.fimExclusivo, rotulo];
      tabelaEscopo = 'cp';
    } else {
      config = DIMENSOES_ETAPA[dimensao];
      if (dimensao === 'mes') {
        const intervaloMes = intervaloAno(periodo.anoRef);
        params = [intervaloMes.inicio, intervaloMes.fimExclusivo];
      } else if (dimensao === 'motivo_devolucao') {
        params = [periodo.anoRef, periodo.mesRef];
      } else {
        params = [periodo.dataInicio, periodo.dataFim];
      }
      tabelaEscopo = dimensao === 'motivo_devolucao' ? 'gi' : 'cp';
    }

    const consulta = aplicarEscopo(config.query, req.usuario, tabelaEscopo, params);
    const origemDados = extrairMetadadosSql(config.query);
    pool.query(consulta.query, consulta.parametros).then(function(result) {
      let dados = result.rows.map(function(row) {
        const qtd = parseInt(row.qtd_contas) || 0;
        const dias = parseInt(row.dias_etapa) || 0;
        const vlConta = parseFloat(row.vl_conta) || 0;
        const valorGlosa = parseFloat(row.valor_glosa) || 0;

        if (dimensao === 'motivo_devolucao') {
          return {
            label: row.label,
            qtd_contas: qtd,
            dias_etapa: 0,
            media_etapa: 0,
            vl_conta: valorGlosa
          };
        }

        return {
          label: row.label,
          qtd_contas: qtd,
          dias_etapa: dias,
          media_etapa: qtd > 0 ? dias / qtd : 0,
          vl_conta: vlConta
        };
      });

      if (indicador && indicador !== 'todos') {
        const cfg = CONFIG_INDICADORES[indicador];
        if (!cfg) {
          return res.status(400).json({ mensagem: 'Indicador inválido: ' + indicador });
        }

        dados = dados.map(function(row) {
          return {
            label: row.label,
            valorRaw: row[indicador] || 0,
            valorFormatado: cfg.isMoeda ? formatarMoeda(row[indicador]) : cfg.isDecimal ? formatarDecimal(row[indicador]) : formatarNumero(row[indicador])
          };
        });

        dados.sort(function(a, b) { return ordem === 'asc' ? a.valorRaw - b.valorRaw : b.valorRaw - a.valorRaw; });
        const totalBase = dados.length;
        dados = dados.slice(0, limite);

        return res.json({
          nomeDimensao: NOMES_DIMENSAO[dimensao] || dimensao,
          nomeIndicador: cfg.nome,
          modoTodos: false,
          isMoeda: cfg.isMoeda,
          isPercentual: cfg.isPercentual,
          isDecimal: cfg.isDecimal,
          color: cfg.color,
          badgeClass: cfg.badgeClass,
          totalBase: totalBase,
          dados: dados,
          fontes: origemDados.tabelas,
          origemDados: origemDados
        });
      }

      dados.forEach(formatarItemMultivariado);
      dados.sort(function(a, b) { return ordem === 'asc' ? a.dias_etapa - b.dias_etapa : b.dias_etapa - a.dias_etapa; });
      const totalBase = dados.length;
      dados = dados.slice(0, limite);

      res.json({
        nomeDimensao: NOMES_DIMENSAO[dimensao] || dimensao,
        modoTodos: true,
        totalBase: totalBase,
        dados: dados,
        fontes: origemDados.tabelas,
        origemDados: origemDados
      });
    }).catch(function(error) {
      logger.error({ err: error }, 'Erro na query de etapa');
      res.status(500).json({ mensagem: 'Erro ao consultar dados de etapa: ' + error.message });
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro no controller de etapa');
    res.status(500).json({ mensagem: 'Erro interno do servidor' });
  }
}

module.exports = { buscarEtapa };
