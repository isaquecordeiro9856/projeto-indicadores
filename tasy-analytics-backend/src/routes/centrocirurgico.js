const express = require('express');
const router = express.Router();
const { autenticar } = require('../middleware/auth');
const { autorizar } = require('../middleware/autorizacao');
const { buscarCentroCirurgico } = require('../controllers/centrocirurgicoController');

router.post('/', autenticar, autorizar('centrocirurgico'), buscarCentroCirurgico);

module.exports = router;
