const pool = require('../config/database');
const { extrairPeriodo, obterLimite, intervaloAno } = require('../utils/periodo');
const { aplicarEscopo } = require('../services/escopoAcesso');
const { extrairMetadadosSql } = require('../utils/extrairFontes');
const logger = require('../config/logger');

const DIMENSOES_FARMACIA = {
  material: {
    query: `
      SELECT
        COALESCE(m.ds_material, 'Material ' || CAST(cm.cd_material AS TEXT)) as label,
        COUNT(*) as qtd_prescricoes,
        COUNT(DISTINCT cm.nr_atendimento) as qtd_pacientes
      FROM ods.cpoe_material cm
      LEFT JOIN ods.material m ON cm.cd_material = m.cd_material
      WHERE cm.dt_liberacao >= $1 AND cm.dt_liberacao <= $2 /* ESCOPO */
        AND cm.ie_item_valido = 'S'
      GROUP BY m.ds_material, cm.cd_material
      ORDER BY qtd_prescricoes DESC
    `
  },
  setor: {
    query: `
      SELECT
        COALESCE(se.ds_setor_atendimento, 'Não Informado') as label,
        COUNT(*) as qtd_prescricoes,
        COUNT(DISTINCT cm.cd_material) as qtd_materiais
      FROM ods.cpoe_material cm
      LEFT JOIN ods.setor_atendimento se ON cm.cd_setor_atendimento = se.cd_setor_atendimento
      WHERE cm.dt_liberacao >= $1 AND cm.dt_liberacao <= $2 /* ESCOPO */
        AND cm.ie_item_valido = 'S'
      GROUP BY se.ds_setor_atendimento
      ORDER BY qtd_prescricoes DESC
    `
  },
  mes: {
    query: `
      SELECT
        TO_CHAR(cm.dt_liberacao, 'YYYY-MM') as label,
        COUNT(*) as qtd_prescricoes,
        COUNT(DISTINCT cm.nr_atendimento) as qtd_pacientes
      FROM ods.cpoe_material cm
      WHERE cm.dt_liberacao >= $1 AND cm.dt_liberacao < $2 /* ESCOPO */
        AND cm.ie_item_valido = 'S'
      GROUP BY TO_CHAR(cm.dt_liberacao, 'YYYY-MM')
      ORDER BY label
    `
  },
  antibiotico: {
    query: `
      SELECT
        CASE WHEN cm.ie_antibiotico = 'S' THEN 'Antibiótico' ELSE 'Não Antibiótico' END as label,
        COUNT(*) as qtd_prescricoes,
        COUNT(DISTINCT cm.nr_atendimento) as qtd_pacientes
      FROM ods.cpoe_material cm
      WHERE cm.dt_liberacao >= $1 AND cm.dt_liberacao <= $2 /* ESCOPO */
        AND cm.ie_item_valido = 'S'
      GROUP BY cm.ie_antibiotico
      ORDER BY qtd_prescricoes DESC
    `
  }
};

const NOMES_DIMENSAO = {
  material: 'Material/Medicamento',
  setor: 'Setor',
  mes: 'Mês',
  antibiotico: 'Tipo'
};

// Coluna (mesma expressão usada como "label" na dimensão de origem) usada
// para filtrar a evolução mensal quando o drill-down parte de uma linha
// específica da tabela.
const COLUNA_FILTRO_MES = {
  material: "COALESCE(m.ds_material, 'Material ' || CAST(cm.cd_material AS TEXT))",
  setor: "COALESCE(se.ds_setor_atendimento, 'Não Informado')",
  antibiotico: "CASE WHEN cm.ie_antibiotico = 'S' THEN 'Antibiótico' ELSE 'Não Antibiótico' END"
};

function construirQueryMesFiltrada(colunaFiltro) {
  return `
    SELECT
      TO_CHAR(cm.dt_liberacao, 'YYYY-MM') as label,
      COUNT(*) as qtd_prescricoes,
      COUNT(DISTINCT cm.nr_atendimento) as qtd_pacientes
    FROM ods.cpoe_material cm
    LEFT JOIN ods.material m ON cm.cd_material = m.cd_material
    LEFT JOIN ods.setor_atendimento se ON cm.cd_setor_atendimento = se.cd_setor_atendimento
    WHERE cm.dt_liberacao >= $1 AND cm.dt_liberacao < $2 AND ${colunaFiltro} = $3 /* ESCOPO */
      AND cm.ie_item_valido = 'S'
    GROUP BY TO_CHAR(cm.dt_liberacao, 'YYYY-MM')
    ORDER BY label
  `;
}

function formatarNumero(v) { return Math.round(v || 0).toLocaleString('pt-BR'); }

function buscarFarmacia(req, res) {
  try {
    const { dimensao, indicador, ordem, dimensaoOrigem, rotulo } = req.body;
    const periodo = extrairPeriodo(req.body);
    const limite = obterLimite(req.body);

    if (!DIMENSOES_FARMACIA[dimensao]) {
      return res.status(400).json({ mensagem: 'Dimensão inválida: ' + dimensao });
    }

    const colunaFiltro = dimensao === 'mes' ? COLUNA_FILTRO_MES[dimensaoOrigem] : null;
    const filtrarPorItem = !!colunaFiltro && rotulo != null && rotulo !== '';

    const config = filtrarPorItem
      ? { query: construirQueryMesFiltrada(colunaFiltro) }
      : DIMENSOES_FARMACIA[dimensao];
    const intervalo = dimensao === 'mes' ? intervaloAno(periodo.anoRef) : null;
    const params = filtrarPorItem
      ? [intervalo.inicio, intervalo.fimExclusivo, rotulo]
      : (dimensao === 'mes' ? [intervalo.inicio, intervalo.fimExclusivo] : [periodo.dataInicio, periodo.dataFim]);

    const consulta = aplicarEscopo(config.query, req.usuario, 'cm', params);
    const origemDados = extrairMetadadosSql(config.query);
    pool.query(consulta.query, consulta.parametros).then(function(result) {
      let dados = result.rows.map(function(row) {
        return {
          label: row.label,
          qtd_prescricoes: parseInt(row.qtd_prescricoes) || 0,
          qtd_pacientes: parseInt(row.qtd_pacientes) || 0,
          qtd_materiais: parseInt(row.qtd_materiais) || 0
        };
      });

      if (indicador && indicador !== 'todos') {
        dados = dados.map(function(row) {
          return { label: row.label, valorRaw: row[indicador] || 0, valorFormatado: formatarNumero(row[indicador] || 0) };
        });
        dados.sort(function(a, b) { return ordem === 'asc' ? a.valorRaw - b.valorRaw : b.valorRaw - a.valorRaw; });
        const totalBase = dados.length;
        dados = dados.slice(0, limite);
        return res.json({ nomeDimensao: NOMES_DIMENSAO[dimensao] || dimensao, nomeIndicador: indicador === 'qtd_pacientes' ? 'Pacientes' : indicador === 'qtd_materiais' ? 'Materiais' : 'Prescrições', modoTodos: false, totalBase: totalBase, dados: dados, fontes: origemDados.tabelas, origemDados: origemDados });
      }

      dados.forEach(function(item) {
        item.qtd_prescricoes_fmt = formatarNumero(item.qtd_prescricoes);
        item.qtd_pacientes_fmt = formatarNumero(item.qtd_pacientes);
        item.qtd_materiais_fmt = formatarNumero(item.qtd_materiais);
      });
      dados.sort(function(a, b) { return ordem === 'asc' ? a.qtd_prescricoes - b.qtd_prescricoes : b.qtd_prescricoes - a.qtd_prescricoes; });
      const totalBase = dados.length;
      dados = dados.slice(0, limite);
      res.json({ nomeDimensao: NOMES_DIMENSAO[dimensao] || dimensao, modoTodos: true, totalBase: totalBase, dados: dados, fontes: origemDados.tabelas, origemDados: origemDados });
    }).catch(function(error) {
      logger.error({ err: error }, 'Erro na query de farmácia');
      res.status(500).json({ mensagem: 'Erro ao consultar dados de farmácia: ' + error.message });
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro no controller de farmácia');
    res.status(500).json({ mensagem: 'Erro interno do servidor' });
  }
}

module.exports = { buscarFarmacia };
