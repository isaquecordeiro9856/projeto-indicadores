const { ehSupervisor } = require('../config/supervisao');

// ═══════════════════════════════════════════════════════════
// ESCOPO DE DADOS
// ═══════════════════════════════════════════════════════════
// O sistema é restrito a supervisão/direção (ver config/supervisao.js), e
// supervisão enxerga TODOS os dados — não existe mais recorte por autoria
// (nm_usuario / cd_pessoa_fisica) nem por setor do usuário. Por isso o
// marcador /* ESCOPO */ das queries é simplesmente removido.
//
// O marcador continua existindo nas queries de propósito: ele é o ponto
// único onde um filtro de linha voltaria a ser injetado caso algum dia o
// acesso seja reaberto para perfis não supervisores.
//
// A cláusula ' AND 1 = 0' abaixo é apenas defesa em profundidade: quem não
// é supervisor já é barrado no login (authController) e no middleware de
// autorização, então em operação normal ela nunca é atingida.
function aplicarEscopo(query, usuario, tabela, parametros) {
  const sql = ehSupervisor(usuario) ? '' : ' AND 1 = 0';
  return {
    query: query.replace('/* ESCOPO */', sql),
    parametros: parametros
  };
}

module.exports = { aplicarEscopo };
