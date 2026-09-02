const express = require('express');
const router = express.Router();
const { buscarGlosas } = require('../controllers/glosasController');
const { cacheDashboard } = require('../middleware/cacheDashboard');
const { autenticar } = require('../middleware/auth');
const { autorizar } = require('../middleware/autorizacao');

router.post('/', autenticar, autorizar('glosas'), cacheDashboard, buscarGlosas);

module.exports = router;
