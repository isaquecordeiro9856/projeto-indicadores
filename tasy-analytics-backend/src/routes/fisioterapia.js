const express = require('express');
const router = express.Router();
const { autenticar } = require('../middleware/auth');
const { autorizar } = require('../middleware/autorizacao');
const { cacheDashboard } = require('../middleware/cacheDashboard');
const { buscarFisioterapia } = require('../controllers/fisioterapiaController');

router.post('/', autenticar, autorizar('fisioterapia'), cacheDashboard, buscarFisioterapia);

module.exports = router;
