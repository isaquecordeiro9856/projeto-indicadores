const express = require('express');
const router = express.Router();
const { buscarGlosas } = require('../controllers/glosasController');
const { autenticar } = require('../middleware/auth');
const { autorizar } = require('../middleware/autorizacao');

router.post('/', autenticar, autorizar('glosas'), buscarGlosas);

module.exports = router;
