const express = require('express');
const router = express.Router();
const { buscarPempfrg } = require('../controllers/pempfrgController');
const { cacheDashboard } = require('../middleware/cacheDashboard');
const { autenticar } = require('../middleware/auth');
const { autorizar } = require('../middleware/autorizacao');

router.post('/', autenticar, autorizar('pempfrg', function(req) { return req.body.dashboard || '__ausente__'; }), cacheDashboard, buscarPempfrg);

module.exports = router;
