const pool = require('../config/database');
const { extrairPeriodo, obterLimite, intervaloAno } = require('../utils/periodo');
const { aplicarEscopo } = require('../services/escopoAcesso');
const { extrairMetadadosSql } = require('../utils/extrairFontes');
const logger = require('../config/logger');

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
        COALESCE(se.ds_setor_atendimento, 'Não Informado') as label,
        COUNT(DISTINCT pp.nr_atendimento) as qtd_contas,
        COUNT(*) as qtd_procedimentos,
        COALESCE(SUM(pp.vl_procedimento), 0) as valor_produzido,
        COALESCE(SUM(pp.vl_medico), 0) as valor_medico
      FROM ods.procedimento_paciente pp
      LEFT JOIN ods.setor_atendimento se ON pp.cd_setor_atendimento = se.cd_setor_atendimento
      WHERE pp.dt_procedimento >= $1 AND pp.dt_procedimento <= $2 /* ESCOPO */
      GROUP BY se.ds_setor_atendimento
      HAVING COUNT(DISTINCT pp.nr_atendimento) > 0
    `
  },
  medico_executor: {
    query: `
      SELECT
        COALESCE(pf.nm_pessoa_fisica, 'Não Informado') as label,
        COUNT(DISTINCT pp.nr_atendimento) as qtd_contas,
        COUNT(*) as qtd_procedimentos,
        COALESCE(SUM(pp.vl_procedimento), 0) as valor_produzido,
        COALESCE(SUM(pp.vl_medico), 0) as valor_medico
      FROM ods.procedimento_paciente pp
      LEFT JOIN ods.pessoa_fisica pf ON pp.cd_medico = pf.cd_pessoa_fisica
      WHERE pp.dt_procedimento >= $1 AND pp.dt_procedimento <= $2 /* ESCOPO */
      GROUP BY pf.nm_pessoa_fisica
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
      WHERE pp.dt_procedimento >= $1 AND pp.dt_procedimento < $2 /* ESCOPO */
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

// Coluna (já com o mesmo COALESCE usado como "label" na dimensão de origem)
// usada para filtrar a evolução mensal quando o drill-down parte de uma
// linha específica da tabela (ex.: clicar num médico deve trazer só a
// evolução mensal daquele médico, não do indicador inteiro).
const COLUNA_FILTRO_MES = {
  convenio: "COALESCE(c.ds_convenio, 'Não Informado')",
  setor: "COALESCE(se.ds_setor_atendimento, 'Não Informado')",
  medico_executor: "COALESCE(pf.nm_pessoa_fisica, 'Não Informado')",
  procedimento: "COALESCE(p.ds_procedimento, 'Não Informado')"
};

function construirQueryMesFiltrada(colunaFiltro) {
  return `
    SELECT
      TO_CHAR(pp.dt_procedimento, 'YYYY-MM') as label,
      COUNT(DISTINCT pp.nr_atendimento) as qtd_contas,
      COUNT(*) as qtd_procedimentos,
      COALESCE(SUM(pp.vl_procedimento), 0) as valor_produzido,
      COALESCE(SUM(pp.vl_medico), 0) as valor_medico
    FROM ods.procedimento_paciente pp
    LEFT JOIN ods.convenio c ON pp.cd_convenio = c.cd_convenio
    LEFT JOIN ods.setor_atendimento se ON pp.cd_setor_atendimento = se.cd_setor_atendimento
    LEFT JOIN ods.pessoa_fisica pf ON pp.cd_medico = pf.cd_pessoa_fisica
    LEFT JOIN ods.procedimento p ON pp.cd_procedimento = p.cd_procedimento
    WHERE pp.dt_procedimento >= $1 AND pp.dt_procedimento < $2 AND ${colunaFiltro} = $3 /* ESCOPO */
    GROUP BY TO_CHAR(pp.dt_procedimento, 'YYYY-MM')
    ORDER BY label
  `;
}

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
    const { dimensao, indicador, ordem, dimensaoOrigem, rotulo } = req.body;
    const periodo = extrairPeriodo(req.body);
    const limite = obterLimite(req.body);

    if (!DIMENSOES_PEMPFRG[dimensao]) {
      return res.status(400).json({ mensagem: 'Dimensão inválida: ' + dimensao });
    }

    // Drill-down de uma linha específica: evolução mensal filtrada pelo
    // item clicado (ex.: só aquele médico), não o indicador inteiro.
    const colunaFiltro = dimensao === 'mes' ? COLUNA_FILTRO_MES[dimensaoOrigem] : null;
    const filtrarPorItem = !!colunaFiltro && rotulo != null && rotulo !== '';

    const config = filtrarPorItem
      ? { query: construirQueryMesFiltrada(colunaFiltro) }
      : DIMENSOES_PEMPFRG[dimensao];
    const intervalo = dimensao === 'mes' ? intervaloAno(periodo.anoRef) : null;
    const params = filtrarPorItem
      ? [intervalo.inicio, intervalo.fimExclusivo, rotulo]
      : (dimensao === 'mes' ? [intervalo.inicio, intervalo.fimExclusivo] : [periodo.dataInicio, periodo.dataFim]);

    const consulta = aplicarEscopo(config.query, req.usuario, 'pp', params);
    const origemDados = extrairMetadadosSql(config.query);
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
          dados: dados,
          fontes: origemDados.tabelas,
          origemDados: origemDados
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
        dados: dados,
        fontes: origemDados.tabelas,
        origemDados: origemDados
      });
    }).catch(function(error) {
      logger.error({ err: error }, 'Erro na query de pempfrg');
      res.status(500).json({ mensagem: 'Erro ao consultar dados de produção: ' + error.message });
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro no controller de pempfrg');
    res.status(500).json({ mensagem: 'Erro interno do servidor' });
  }
}

module.exports = { buscarPempfrg };
