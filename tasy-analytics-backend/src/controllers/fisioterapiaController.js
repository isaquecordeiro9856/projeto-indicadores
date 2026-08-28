const pool = require('../config/database');
const { extrairPeriodo, obterLimite } = require('../utils/periodo');
const { aplicarEscopo } = require('../services/escopoAcesso');

const DIMENSOES_FISIO = {
  procedimento: {
    query: `
      SELECT
        COALESCE(p.ds_procedimento, 'Não Informado') as label,
        COUNT(DISTINCT pp.nr_atendimento) as qtd_contas,
        COUNT(*) as qtd_atendimentos,
        COALESCE(SUM(pp.vl_procedimento), 0) as valor_produzido,
        COALESCE(SUM(pp.vl_medico), 0) as valor_medico
      FROM ods.procedimento_paciente pp
      LEFT JOIN ods.procedimento p ON pp.cd_procedimento = p.cd_procedimento
      WHERE pp.dt_procedimento >= $1 AND pp.dt_procedimento <= $2 /* ESCOPO */
        AND p.ds_procedimento ILIKE '%fisio%'
      GROUP BY p.ds_procedimento
      HAVING COUNT(DISTINCT pp.nr_atendimento) > 0
      ORDER BY qtd_atendimentos DESC
    `
  },
  convenio: {
    query: `
      SELECT
        COALESCE(c.ds_convenio, 'Não Informado') as label,
        COUNT(DISTINCT pp.nr_atendimento) as qtd_contas,
        COUNT(*) as qtd_atendimentos,
        COALESCE(SUM(pp.vl_procedimento), 0) as valor_produzido
      FROM ods.procedimento_paciente pp
      LEFT JOIN ods.convenio c ON pp.cd_convenio = c.cd_convenio
      LEFT JOIN ods.procedimento p ON pp.cd_procedimento = p.cd_procedimento
      WHERE pp.dt_procedimento >= $1 AND pp.dt_procedimento <= $2 /* ESCOPO */
        AND p.ds_procedimento ILIKE '%fisio%'
      GROUP BY c.ds_convenio
      HAVING COUNT(DISTINCT pp.nr_atendimento) > 0
    `
  },
  setor: {
    query: `
      SELECT
        COALESCE(CAST(pp.cd_setor_atendimento AS TEXT), 'Não Informado') as label,
        COUNT(DISTINCT pp.nr_atendimento) as qtd_contas,
        COUNT(*) as qtd_atendimentos,
        COALESCE(SUM(pp.vl_procedimento), 0) as valor_produzido
      FROM ods.procedimento_paciente pp
      LEFT JOIN ods.procedimento p ON pp.cd_procedimento = p.cd_procedimento
      WHERE pp.dt_procedimento >= $1 AND pp.dt_procedimento <= $2 /* ESCOPO */
        AND p.ds_procedimento ILIKE '%fisio%'
      GROUP BY pp.cd_setor_atendimento
      HAVING COUNT(DISTINCT pp.nr_atendimento) > 0
    `
  },
  medico: {
    query: `
      SELECT
        COALESCE(CAST(pp.cd_medico AS TEXT), 'Não Informado') as label,
        COUNT(DISTINCT pp.nr_atendimento) as qtd_contas,
        COUNT(*) as qtd_atendimentos,
        COALESCE(SUM(pp.vl_procedimento), 0) as valor_produzido
      FROM ods.procedimento_paciente pp
      LEFT JOIN ods.procedimento p ON pp.cd_procedimento = p.cd_procedimento
      WHERE pp.dt_procedimento >= $1 AND pp.dt_procedimento <= $2 /* ESCOPO */
        AND p.ds_procedimento ILIKE '%fisio%'
      GROUP BY pp.cd_medico
      HAVING COUNT(DISTINCT pp.nr_atendimento) > 0
    `
  },
  mes: {
    query: `
      SELECT
        TO_CHAR(pp.dt_procedimento, 'YYYY-MM') as label,
        COUNT(DISTINCT pp.nr_atendimento) as qtd_contas,
        COUNT(*) as qtd_atendimentos,
        COALESCE(SUM(pp.vl_procedimento), 0) as valor_produzido
      FROM ods.procedimento_paciente pp
      LEFT JOIN ods.procedimento p ON pp.cd_procedimento = p.cd_procedimento
      WHERE EXTRACT(YEAR FROM pp.dt_procedimento) = $1 /* ESCOPO */
        AND p.ds_procedimento ILIKE '%fisio%'
      GROUP BY TO_CHAR(pp.dt_procedimento, 'YYYY-MM')
      ORDER BY label
    `
  }
};

const NOMES_DIMENSAO = {
  procedimento: 'Procedimento',
  convenio: 'Convênio',
  setor: 'Setor',
  medico: 'Profissional',
  mes: 'Mês'
};

function formatarMoeda(v) { return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }); }
function formatarNumero(v) { return Math.round(v || 0).toLocaleString('pt-BR'); }

function buscarFisioterapia(req, res) {
  try {
    const { dimensao, indicador, ordem } = req.body;
    const periodo = extrairPeriodo(req.body);
    const limite = obterLimite(req.body);

    if (!DIMENSOES_FISIO[dimensao]) {
      return res.status(400).json({ mensagem: 'Dimensão inválida: ' + dimensao });
    }

    const config = DIMENSOES_FISIO[dimensao];
    const params = dimensao === 'mes' ? [periodo.anoRef] : [periodo.dataInicio, periodo.dataFim];

    const consulta = aplicarEscopo(config.query, req.usuario, 'pp', params);
    pool.query(consulta.query, consulta.parametros).then(function(result) {
      let dados = result.rows.map(function(row) {
        return {
          label: row.label,
          qtd_contas: parseInt(row.qtd_contas) || 0,
          qtd_atendimentos: parseInt(row.qtd_atendimentos) || 0,
          valor_produzido: parseFloat(row.valor_produzido) || 0,
          valor_medico: parseFloat(row.valor_medico) || 0
        };
      });

      if (indicador && indicador !== 'todos') {
        var cfg = { qtd_contas: { nome: 'Atendimentos' }, qtd_atendimentos: { nome: 'Atendimentos Fisio' }, valor_produzido: { nome: 'Valor Produzido', isMoeda: true }, valor_medico: { nome: 'Valor Profissional', isMoeda: true } };
        if (!cfg[indicador]) {
          return res.status(400).json({ mensagem: 'Indicador inválido: ' + indicador });
        }
        dados = dados.map(function(row) {
          return {
            label: row.label,
            valorRaw: row[indicador] || 0,
            valorFormatado: cfg[indicador].isMoeda ? formatarMoeda(row[indicador]) : formatarNumero(row[indicador])
          };
        });
        dados.sort(function(a, b) { return ordem === 'asc' ? a.valorRaw - b.valorRaw : b.valorRaw - a.valorRaw; });
        var totalBase = dados.length;
        dados = dados.slice(0, limite);
        return res.json({ nomeDimensao: NOMES_DIMENSAO[dimensao] || dimensao, nomeIndicador: cfg[indicador].nome, modoTodos: false, totalBase: totalBase, dados: dados });
      }

      dados.forEach(function(item) {
        item.qtd_contas_fmt = formatarNumero(item.qtd_contas);
        item.qtd_atendimentos_fmt = formatarNumero(item.qtd_atendimentos);
        item.valor_produzido_fmt = formatarMoeda(item.valor_produzido);
      });
      dados.sort(function(a, b) { return ordem === 'asc' ? a.qtd_atendimentos - b.qtd_atendimentos : b.qtd_atendimentos - a.qtd_atendimentos; });
      var totalBase = dados.length;
      dados = dados.slice(0, limite);
      res.json({ nomeDimensao: NOMES_DIMENSAO[dimensao] || dimensao, modoTodos: true, totalBase: totalBase, dados: dados });
    }).catch(function(error) {
      console.error('Erro na query de fisioterapia:', error.message);
      res.status(500).json({ mensagem: 'Erro ao consultar dados de fisioterapia: ' + error.message });
    });
  } catch (error) {
    console.error('Erro no controller de fisioterapia:', error);
    res.status(500).json({ mensagem: 'Erro interno do servidor' });
  }
}

module.exports = { buscarFisioterapia };
