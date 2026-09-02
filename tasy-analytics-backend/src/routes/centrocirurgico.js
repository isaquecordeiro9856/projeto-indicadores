const express = require('express');
const router = express.Router();
const { autenticar } = require('../middleware/auth');
const { autorizar } = require('../middleware/autorizacao');
const { cacheDashboard } = require('../middleware/cacheDashboard');
const { buscarCentroCirurgico } = require('../controllers/centrocirurgicoController');

router.post('/', autenticar, autorizar('centrocirurgico'), cacheDashboard, buscarCentroCirurgico);

module.exports = router;
