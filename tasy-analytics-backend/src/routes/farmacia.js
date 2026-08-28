const express = require('express');
const router = express.Router();
const { autenticar } = require('../middleware/auth');
const { autorizar } = require('../middleware/autorizacao');
const { buscarFarmacia } = require('../controllers/farmaciaController');

router.post('/', autenticar, autorizar('farmacia'), buscarFarmacia);

module.exports = router;
