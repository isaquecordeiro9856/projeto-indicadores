const pool = require('../config/database');
const { extrairPeriodo, obterLimite } = require('../utils/periodo');
const { aplicarEscopo } = require('../services/escopoAcesso');

const DIMENSOES_GLOSAS = {
  convenio: {
    query: `
      SELECT
        ds_convenio as label,
        COALESCE(SUM(vl_protocolo), 0) as valor_faturado,
        COALESCE(SUM(vl_glosado), 0) as valor_glosado,
        COALESCE(SUM(vl_pago), 0) as valor_recebido,
        COALESCE(SUM(vl_aceito), 0) as valor_glosa_aceita,
        COALESCE(SUM(vl_reapresentado), 0) as valor_reapresentado,
        COALESCE(SUM(vl_adicional), 0) as valor_adicional,
        COALESCE(SUM(vl_retorno), 0) as valor_retorno
      FROM ods.glosas_protocolos gp
      WHERE ano_ref = $1 AND mes_ref = $2 /* ESCOPO */
      GROUP BY ds_convenio
      HAVING SUM(vl_protocolo) > 0
    `
  },
  estabelecimento: {
    query: `
      SELECT
        ds_estabelecimento as label,
        COALESCE(SUM(vl_protocolo), 0) as valor_faturado,
        COALESCE(SUM(vl_glosado), 0) as valor_glosado,
        COALESCE(SUM(vl_pago), 0) as valor_recebido,
        COALESCE(SUM(vl_aceito), 0) as valor_glosa_aceita,
        COALESCE(SUM(vl_reapresentado), 0) as valor_reapresentado,
        COALESCE(SUM(vl_adicional), 0) as valor_adicional,
        COALESCE(SUM(vl_retorno), 0) as valor_retorno
      FROM ods.glosas_protocolos gp
      WHERE ano_ref = $1 AND mes_ref = $2 /* ESCOPO */
      GROUP BY ds_estabelecimento
      HAVING SUM(vl_protocolo) > 0
    `
  },
  setor: {
    query: `
      SELECT
        COALESCE(ds_setor_atendimento, 'Sem Setor') as label,
        COALESCE(SUM(vl_item), 0) as valor_faturado,
        COALESCE(SUM(vl_glosa), 0) as valor_glosado,
        COALESCE(SUM(vl_pago), 0) as valor_recebido
      FROM ods.glosas_por_item gi
      WHERE ano_ref = $1 AND mes_ref = $2 /* ESCOPO */
      GROUP BY ds_setor_atendimento
      HAVING SUM(vl_item) > 0
    `
  },
  tipo_convenio: {
    query: `
      SELECT
        ds_tipo_convenio as label,
        COALESCE(SUM(vl_protocolo), 0) as valor_faturado,
        COALESCE(SUM(vl_glosado), 0) as valor_glosado,
        COALESCE(SUM(vl_pago), 0) as valor_recebido,
        COALESCE(SUM(vl_aceito), 0) as valor_glosa_aceita,
        COALESCE(SUM(vl_reapresentado), 0) as valor_reapresentado,
        COALESCE(SUM(vl_adicional), 0) as valor_adicional,
        COALESCE(SUM(vl_retorno), 0) as valor_retorno
      FROM ods.glosas_protocolos gp
      WHERE ano_ref = $1 AND mes_ref = $2 /* ESCOPO */
      GROUP BY ds_tipo_convenio
      HAVING SUM(vl_protocolo) > 0
    `
  },
  tipo_protocolo: {
    query: `
      SELECT
        ds_tipo_protocolo as label,
        COALESCE(SUM(vl_protocolo), 0) as valor_faturado,
        COALESCE(SUM(vl_glosado), 0) as valor_glosado,
        COALESCE(SUM(vl_pago), 0) as valor_recebido,
        COALESCE(SUM(vl_aceito), 0) as valor_glosa_aceita,
        COALESCE(SUM(vl_reapresentado), 0) as valor_reapresentado,
        COALESCE(SUM(vl_adicional), 0) as valor_adicional,
        COALESCE(SUM(vl_retorno), 0) as valor_retorno
      FROM ods.glosas_protocolos gp
      WHERE ano_ref = $1 AND mes_ref = $2 /* ESCOPO */
      GROUP BY ds_tipo_protocolo
      HAVING SUM(vl_protocolo) > 0
    `
  },
  mes: {
    query: `
      SELECT
        mes_ref as label,
        COALESCE(SUM(vl_protocolo), 0) as valor_faturado,
        COALESCE(SUM(vl_glosado), 0) as valor_glosado,
        COALESCE(SUM(vl_pago), 0) as valor_recebido,
        COALESCE(SUM(vl_aceito), 0) as valor_glosa_aceita,
        COALESCE(SUM(vl_reapresentado), 0) as valor_reapresentado,
        COALESCE(SUM(vl_adicional), 0) as valor_adicional,
        COALESCE(SUM(vl_retorno), 0) as valor_retorno
      FROM ods.glosas_protocolos gp
      WHERE ano_ref = $1 /* ESCOPO */
      GROUP BY mes_ref
      ORDER BY mes_ref
    `
  }
};

const NOMES_DIMENSAO = {
  convenio: 'Convênio',
  estabelecimento: 'Estabelecimento',
  setor: 'Setor',
  tipo_convenio: 'Tipo Convênio',
  tipo_protocolo: 'Tipo Protocolo',
  mes: 'Mês',
  ano: 'Ano'
};

const CONFIG_INDICADORES = {
  valor_faturado: { nome: 'Valor Faturado', isMoeda: true, isPercentual: false, color: '#2563eb', badgeClass: 'badge-val-faturado' },
  valor_recebido: { nome: 'Valor Recebido', isMoeda: true, isPercentual: false, color: '#059669', badgeClass: 'badge-val-recebido' },
  valor_a_receber: { nome: 'Valor a Receber', isMoeda: true, isPercentual: false, color: '#0284c7', badgeClass: 'badge-val-a-receber' },
  valor_glosado: { nome: 'Valor Glosado', isMoeda: true, isPercentual: false, color: '#dc2626', badgeClass: 'badge-val-glosado' },
  valor_glosa_aceita: { nome: 'Valor Glosa Aceita', isMoeda: true, isPercentual: false, color: '#991b1b', badgeClass: 'badge-val-glosa-aceita' },
  valor_reapresentado: { nome: 'Valor Reapresentado', isMoeda: true, isPercentual: false, color: '#d97706', badgeClass: 'badge-val-reapresentado' },
  valor_adicional: { nome: 'Valor Adicional', isMoeda: true, isPercentual: false, color: '#7c3aed', badgeClass: 'badge-val-adicional' },
  valor_retorno: { nome: 'Valor Retorno', isMoeda: true, isPercentual: false, color: '#0d9488', badgeClass: 'badge-val-retorno' },
  pct_recebido: { nome: '% Recebido', isMoeda: false, isPercentual: true, color: '#059669', badgeClass: 'badge-pct-recebido' },
  pct_glosado: { nome: '% Glosado', isMoeda: false, isPercentual: true, color: '#dc2626', badgeClass: 'badge-pct-glosado' },
  pct_glosa_aceita: { nome: '% Glosa Aceita', isMoeda: false, isPercentual: true, color: '#991b1b', badgeClass: 'badge-pct-glosa-aceita' },
  pct_adicional: { nome: '% Adicional', isMoeda: false, isPercentual: true, color: '#7c3aed', badgeClass: 'badge-pct-adicional' }
};

const INDICADORES_BASICOS = ['valor_faturado', 'valor_recebido', 'valor_glosado', 'valor_glosa_aceita', 'valor_reapresentado', 'valor_adicional', 'valor_retorno'];

function formatarMoeda(v) { return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }); }
function formatarPct(v) { return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + '%'; }

function calcularDerivados(item) {
  const fat = item.valor_faturado || 0;
  if (fat > 0) {
    item.valor_a_receber = Math.max(0, fat - (item.valor_recebido || 0) - (item.valor_glosa_aceita || 0));
    item.pct_recebido = ((item.valor_recebido || 0) / fat) * 100;
    item.pct_glosado = ((item.valor_glosado || 0) / fat) * 100;
    item.pct_glosa_aceita = ((item.valor_glosa_aceita || 0) / fat) * 100;
    item.pct_adicional = ((item.valor_adicional || 0) / fat) * 100;
  } else {
    item.valor_a_receber = 0;
    item.pct_recebido = 0;
    item.pct_glosado = 0;
    item.pct_glosa_aceita = 0;
    item.pct_adicional = 0;
  }
  return item;
}

function formatarItemMultivariado(item) {
  Object.keys(CONFIG_INDICADORES).forEach(function(key) {
    const cfg = CONFIG_INDICADORES[key];
    const val = item[key];
    if (val != null) {
      item[key + '_fmt'] = cfg.isMoeda ? formatarMoeda(val) : formatarPct(val);
    }
  });
  return item;
}

function formatarItemIndividual(item, indicador) {
  const cfg = CONFIG_INDICADORES[indicador];
  if (!cfg) return item;
  const val = item.valorRaw;
  item.valorFormatado = cfg.isMoeda ? formatarMoeda(val) : formatarPct(val);
  if (item.valorAnteriorRaw != null) {
    item.valorAnteriorFormatado = cfg.isMoeda ? formatarMoeda(item.valorAnteriorRaw) : formatarPct(item.valorAnteriorRaw);
    item.variacao = item.valorAnteriorRaw > 0 ? ((val - item.valorAnteriorRaw) / item.valorAnteriorRaw) * 100 : 0;
  }
  return item;
}

function buscarGlosas(req, res) {
  try {
    const { dimensao, indicador, modo, ordem, limite: limiteRaw } = req.body;
    const periodo = extrairPeriodo(req.body);
    const limite = obterLimite(req.body);

    if (!DIMENSOES_GLOSAS[dimensao]) {
      return res.status(400).json({ mensagem: 'Dimensão inválida: ' + dimensao });
    }

    const config = DIMENSOES_GLOSAS[dimensao];
    const params = dimensao === 'mes' ? [periodo.anoRef] : [periodo.anoRef, periodo.mesRef];

    const tabelaEscopo = dimensao === 'setor' ? 'gi' : 'gp';
    const consulta = aplicarEscopo(config.query, req.usuario, tabelaEscopo, params);
    pool.query(consulta.query, consulta.parametros).then(function(result) {
      let dados = result.rows;

      if (indicador !== 'todos') {
        const cfg = CONFIG_INDICADORES[indicador];
        if (!cfg) {
          return res.status(400).json({ mensagem: 'Indicador inválido: ' + indicador });
        }

        dados = dados.map(function(row) {
          return {
            label: row.label,
            valorRaw: parseFloat(row[indicador]) || 0,
            valorFormatado: cfg.isMoeda ? formatarMoeda(row[indicador]) : formatarPct(row[indicador])
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
          color: cfg.color,
          badgeClass: cfg.badgeClass,
          totalBase: totalBase,
          dados: dados
        });
      }

      dados = dados.map(function(row) {
        const item = {
          label: row.label,
          valor_faturado: parseFloat(row.valor_faturado) || 0,
          valor_glosado: parseFloat(row.valor_glosado) || 0,
          valor_recebido: parseFloat(row.valor_recebido) || 0,
          valor_glosa_aceita: parseFloat(row.valor_glosa_aceita) || 0,
          valor_reapresentado: parseFloat(row.valor_reapresentado) || 0,
          valor_adicional: parseFloat(row.valor_adicional) || 0,
          valor_retorno: parseFloat(row.valor_retorno) || 0
        };
        calcularDerivados(item);
        formatarItemMultivariado(item);
        item.valorRawSort = item.valor_faturado;
        return item;
      });

      dados.sort(function(a, b) { return ordem === 'asc' ? a.valorRawSort - b.valorRawSort : b.valorRawSort - a.valorRawSort; });
      const totalBase = dados.length;
      dados = dados.slice(0, limite);

      res.json({
        nomeDimensao: NOMES_DIMENSAO[dimensao] || dimensao,
        modoTodos: true,
        totalBase: totalBase,
        dados: dados
      });
    }).catch(function(error) {
      console.error('Erro na query de glosas:', error);
      res.status(500).json({ mensagem: 'Erro ao consultar dados de glosas' });
    });
  } catch (error) {
    console.error('Erro no controller de glosas:', error);
    res.status(500).json({ mensagem: 'Erro interno do servidor' });
  }
}

module.exports = { buscarGlosas };
