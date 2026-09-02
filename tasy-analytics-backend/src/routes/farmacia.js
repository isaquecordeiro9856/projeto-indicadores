const express = require('express');
const router = express.Router();
const { autenticar } = require('../middleware/auth');
const { autorizar } = require('../middleware/autorizacao');
const { cacheDashboard } = require('../middleware/cacheDashboard');
const { buscarFarmacia } = require('../controllers/farmaciaController');

router.post('/', autenticar, autorizar('farmacia'), cacheDashboard, buscarFarmacia);

module.exports = router;
