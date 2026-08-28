const pool = require('../config/database');
const { extrairPeriodo, obterLimite } = require('../utils/periodo');
const { aplicarEscopo } = require('../services/escopoAcesso');

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
    query: `
      SELECT
        COALESCE(CAST(cp.cd_estabelecimento AS TEXT), 'Não Informado') as label,
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
      WHERE gi.ano_ref = $1 AND gi.mes_ref = $2 /* ESCOPO */
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
      WHERE EXTRACT(YEAR FROM cp.dt_mesano_referencia) = $1 /* ESCOPO */
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
    const { dimensao, indicador, ordem } = req.body;
    const periodo = extrairPeriodo(req.body);
    const limite = obterLimite(req.body);

    if (!DIMENSOES_ETAPA[dimensao]) {
      return res.status(400).json({ mensagem: 'Dimensão inválida: ' + dimensao });
    }

    const config = DIMENSOES_ETAPA[dimensao];
    let params;
    if (dimensao === 'mes') {
      params = [periodo.anoRef];
    } else if (dimensao === 'motivo_devolucao') {
      params = [periodo.anoRef, periodo.mesRef];
    } else {
      params = [periodo.dataInicio, periodo.dataFim];
    }

    const tabelaEscopo = dimensao === 'motivo_devolucao' ? 'gi' : 'cp';
    const consulta = aplicarEscopo(config.query, req.usuario, tabelaEscopo, params);
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
          dados: dados
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
        dados: dados
      });
    }).catch(function(error) {
      console.error('Erro na query de etapa:', error.message);
      res.status(500).json({ mensagem: 'Erro ao consultar dados de etapa: ' + error.message });
    });
  } catch (error) {
    console.error('Erro no controller de etapa:', error);
    res.status(500).json({ mensagem: 'Erro interno do servidor' });
  }
}

module.exports = { buscarEtapa };
