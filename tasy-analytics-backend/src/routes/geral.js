const express = require('express');
const router = express.Router();
const {
  buscarGeral, obterCatalogo, buscarResumo, buscarEvolucao, buscarTendencia
} = require('../controllers/geralController');
const { cacheDashboardPor } = require('../middleware/cacheDashboard');
const { autenticar } = require('../middleware/auth');
const { exigirDirecao } = require('../middleware/autorizacao');

// As consultas do Painel Geral varrem o ODS inteiro (o ODS não tem
// índice de data em nenhuma das tabelas grandes) e olham para dados
// replicados — 15 min de cache em vez do 1 min padrão.
const cacheGeral = cacheDashboardPor(15 * 60 * 1000);

// Painel Geral: exclusivo da direção (ver config/supervisao.js).
router.get('/catalogo', autenticar, exigirDirecao, obterCatalogo);
router.post('/resumo', autenticar, exigirDirecao, cacheGeral, buscarResumo);
router.post('/evolucao', autenticar, exigirDirecao, cacheGeral, buscarEvolucao);
// Tendência é sob demanda e sempre o ano inteiro: o cache é o que faz
// fechar e reabrir o cartão não custar uma segunda varredura.
router.post('/tendencia', autenticar, exigirDirecao, cacheGeral, buscarTendencia);
router.post('/', autenticar, exigirDirecao, cacheGeral, buscarGeral);

module.exports = router;
