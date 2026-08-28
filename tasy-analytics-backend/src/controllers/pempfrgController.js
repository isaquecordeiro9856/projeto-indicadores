const pool = require('../config/database');
const { extrairPeriodo, obterLimite } = require('../utils/periodo');
const { aplicarEscopo } = require('../services/escopoAcesso');

const DIMENSOES_PEMPFRG = {
  convenio: {
    query: `
      SELECT
        COALESCE(c.ds_convenio, 'Não Informado') as label,
        COUNT(DISTINCT pp.nr_atendimento) as qtd_contas,
        COUNT(*) as qtd_procedimentos,
        COALESCE(SUM(pp.vl_procedimento), 0) as valor_produzido,
        COALESCE(SUM(pp.vl_medico), 0) as valor_medico
      FROM ods.procedimento_paciente pp
      LEFT JOIN ods.convenio c ON pp.cd_convenio = c.cd_convenio
      WHERE pp.dt_procedimento >= $1 AND pp.dt_procedimento <= $2 /* ESCOPO */
      GROUP BY c.ds_convenio
      HAVING COUNT(DISTINCT pp.nr_atendimento) > 0
    `
  },
  setor: {
    query: `
      SELECT
        COALESCE(CAST(pp.cd_setor_atendimento AS TEXT), 'Não Informado') as label,
        COUNT(DISTINCT pp.nr_atendimento) as qtd_contas,
        COUNT(*) as qtd_procedimentos,
        COALESCE(SUM(pp.vl_procedimento), 0) as valor_produzido,
        COALESCE(SUM(pp.vl_medico), 0) as valor_medico
      FROM ods.procedimento_paciente pp
      WHERE pp.dt_procedimento >= $1 AND pp.dt_procedimento <= $2 /* ESCOPO */
      GROUP BY pp.cd_setor_atendimento
      HAVING COUNT(DISTINCT pp.nr_atendimento) > 0
    `
  },
  medico_executor: {
    query: `
      SELECT
        COALESCE(CAST(pp.cd_medico AS TEXT), 'Não Informado') as label,
        COUNT(DISTINCT pp.nr_atendimento) as qtd_contas,
        COUNT(*) as qtd_procedimentos,
        COALESCE(SUM(pp.vl_procedimento), 0) as valor_produzido,
        COALESCE(SUM(pp.vl_medico), 0) as valor_medico
      FROM ods.procedimento_paciente pp
      WHERE pp.dt_procedimento >= $1 AND pp.dt_procedimento <= $2 /* ESCOPO */
      GROUP BY pp.cd_medico
      HAVING COUNT(DISTINCT pp.nr_atendimento) > 0
    `
  },
  procedimento: {
    query: `
      SELECT
        COALESCE(p.ds_procedimento, 'Não Informado') as label,
        COUNT(DISTINCT pp.nr_atendimento) as qtd_contas,
        COUNT(*) as qtd_procedimentos,
        COALESCE(SUM(pp.vl_procedimento), 0) as valor_produzido,
        COALESCE(SUM(pp.vl_medico), 0) as valor_medico
      FROM ods.procedimento_paciente pp
      LEFT JOIN ods.procedimento p ON pp.cd_procedimento = p.cd_procedimento
      WHERE pp.dt_procedimento >= $1 AND pp.dt_procedimento <= $2 /* ESCOPO */
      GROUP BY p.ds_procedimento
      HAVING COUNT(DISTINCT pp.nr_atendimento) > 0
    `
  },
  mes: {
    query: `
      SELECT
        TO_CHAR(pp.dt_procedimento, 'YYYY-MM') as label,
        COUNT(DISTINCT pp.nr_atendimento) as qtd_contas,
        COUNT(*) as qtd_procedimentos,
        COALESCE(SUM(pp.vl_procedimento), 0) as valor_produzido,
        COALESCE(SUM(pp.vl_medico), 0) as valor_medico
      FROM ods.procedimento_paciente pp
      WHERE EXTRACT(YEAR FROM pp.dt_procedimento) = $1 /* ESCOPO */
      GROUP BY TO_CHAR(pp.dt_procedimento, 'YYYY-MM')
      ORDER BY label
    `
  }
};

const NOMES_DIMENSAO = {
  convenio: 'Convênio',
  setor: 'Setor',
  medico_executor: 'Médico Executor',
  procedimento: 'Procedimento',
  mes: 'Mês'
};

const CONFIG_INDICADORES = {
  qtd_contas: { nome: 'Qtde Atendimentos', isMoeda: false, isPercentual: false, color: '#475569', badgeClass: 'badge-qtd-contas' },
  qtd_procedimentos: { nome: 'Qtde Procedimentos', isMoeda: false, isPercentual: false, color: '#6366f1', badgeClass: 'badge-qtd-proced' },
  valor_produzido: { nome: 'Valor Produzido', isMoeda: true, isPercentual: false, color: '#8b5cf6', badgeClass: 'badge-val-prod' },
  valor_medico: { nome: 'Valor Médico', isMoeda: true, isPercentual: false, color: '#0d9488', badgeClass: 'badge-val-medico' }
};

function formatarMoeda(v) { return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }); }
function formatarNumero(v) { return Math.round(v || 0).toLocaleString('pt-BR'); }

function formatarItemMultivariado(item) {
  item.qtd_contas_fmt = formatarNumero(item.qtd_contas);
  item.qtd_procedimentos_fmt = formatarNumero(item.qtd_procedimentos);
  item.valor_produzido_fmt = formatarMoeda(item.valor_produzido);
  item.valor_medico_fmt = formatarMoeda(item.valor_medico);
  return item;
}

function buscarPempfrg(req, res) {
  try {
    const { dimensao, indicador, ordem } = req.body;
    const periodo = extrairPeriodo(req.body);
    const limite = obterLimite(req.body);

    if (!DIMENSOES_PEMPFRG[dimensao]) {
      return res.status(400).json({ mensagem: 'Dimensão inválida: ' + dimensao });
    }

    const config = DIMENSOES_PEMPFRG[dimensao];
    const params = dimensao === 'mes' ? [periodo.anoRef] : [periodo.dataInicio, periodo.dataFim];

    const consulta = aplicarEscopo(config.query, req.usuario, 'pp', params);
    pool.query(consulta.query, consulta.parametros).then(function(result) {
      let dados = result.rows.map(function(row) {
        return {
          label: row.label,
          qtd_contas: parseInt(row.qtd_contas) || 0,
          qtd_procedimentos: parseInt(row.qtd_procedimentos) || 0,
          valor_produzido: parseFloat(row.valor_produzido) || 0,
          valor_medico: parseFloat(row.valor_medico) || 0
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
            valorFormatado: cfg.isMoeda ? formatarMoeda(row[indicador]) : formatarNumero(row[indicador])
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

      dados.forEach(formatarItemMultivariado);
      dados.sort(function(a, b) { return ordem === 'asc' ? a.valor_produzido - b.valor_produzido : b.valor_produzido - a.valor_produzido; });
      const totalBase = dados.length;
      dados = dados.slice(0, limite);

      res.json({
        nomeDimensao: NOMES_DIMENSAO[dimensao] || dimensao,
        modoTodos: true,
        totalBase: totalBase,
        dados: dados
      });
    }).catch(function(error) {
      console.error('Erro na query de pempfrg:', error.message);
      res.status(500).json({ mensagem: 'Erro ao consultar dados de produção: ' + error.message });
    });
  } catch (error) {
    console.error('Erro no controller de pempfrg:', error);
    res.status(500).json({ mensagem: 'Erro interno do servidor' });
  }
}

module.exports = { buscarPempfrg };
