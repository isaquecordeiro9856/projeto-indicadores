const express = require('express');
const router = express.Router();
const { buscarEtapa } = require('../controllers/etapaController');
const { autenticar } = require('../middleware/auth');
const { autorizar } = require('../middleware/autorizacao');

router.post('/', autenticar, autorizar('etapa'), buscarEtapa);

module.exports = router;
