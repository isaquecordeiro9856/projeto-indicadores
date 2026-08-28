const pool = require('../config/database');
const { extrairPeriodo, obterLimite } = require('../utils/periodo');
const { aplicarEscopo } = require('../services/escopoAcesso');

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
        COALESCE(CAST(cm.cd_setor_atendimento AS TEXT), 'Não Informado') as label,
        COUNT(*) as qtd_prescricoes,
        COUNT(DISTINCT cm.cd_material) as qtd_materiais
      FROM ods.cpoe_material cm
      WHERE cm.dt_liberacao >= $1 AND cm.dt_liberacao <= $2 /* ESCOPO */
        AND cm.ie_item_valido = 'S'
      GROUP BY cm.cd_setor_atendimento
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
      WHERE EXTRACT(YEAR FROM cm.dt_liberacao) = $1 /* ESCOPO */
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

function formatarNumero(v) { return Math.round(v || 0).toLocaleString('pt-BR'); }

function buscarFarmacia(req, res) {
  try {
    const { dimensao, indicador, ordem } = req.body;
    const periodo = extrairPeriodo(req.body);
    const limite = obterLimite(req.body);

    if (!DIMENSOES_FARMACIA[dimensao]) {
      return res.status(400).json({ mensagem: 'Dimensão inválida: ' + dimensao });
    }

    const config = DIMENSOES_FARMACIA[dimensao];
    const params = dimensao === 'mes' ? [periodo.anoRef] : [periodo.dataInicio, periodo.dataFim];

    const consulta = aplicarEscopo(config.query, req.usuario, 'cm', params);
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
        return res.json({ nomeDimensao: NOMES_DIMENSAO[dimensao] || dimensao, nomeIndicador: indicador === 'qtd_pacientes' ? 'Pacientes' : indicador === 'qtd_materiais' ? 'Materiais' : 'Prescrições', modoTodos: false, totalBase: totalBase, dados: dados });
      }

      dados.forEach(function(item) { item.qtd_prescricoes_fmt = formatarNumero(item.qtd_prescricoes); item.qtd_pacientes_fmt = formatarNumero(item.qtd_pacientes); });
      dados.sort(function(a, b) { return ordem === 'asc' ? a.qtd_prescricoes - b.qtd_prescricoes : b.qtd_prescricoes - a.qtd_prescricoes; });
      const totalBase = dados.length;
      dados = dados.slice(0, limite);
      res.json({ nomeDimensao: NOMES_DIMENSAO[dimensao] || dimensao, modoTodos: true, totalBase: totalBase, dados: dados });
    }).catch(function(error) {
      console.error('Erro na query de farmácia:', error.message);
      res.status(500).json({ mensagem: 'Erro ao consultar dados de farmácia: ' + error.message });
    });
  } catch (error) {
    console.error('Erro no controller de farmácia:', error);
    res.status(500).json({ mensagem: 'Erro interno do servidor' });
  }
}

module.exports = { buscarFarmacia };
