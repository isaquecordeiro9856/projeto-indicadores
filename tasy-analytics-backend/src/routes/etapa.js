const express = require('express');
const router = express.Router();
const { buscarEtapa } = require('../controllers/etapaController');
const { cacheDashboard } = require('../middleware/cacheDashboard');
const { autenticar } = require('../middleware/auth');
const { autorizar } = require('../middleware/autorizacao');

router.post('/', autenticar, autorizar('etapa'), cacheDashboard, buscarEtapa);

module.exports = router;
