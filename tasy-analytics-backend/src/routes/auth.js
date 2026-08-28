const express = require('express');
const router = express.Router();
const { login, me, resetSenhaTemp } = require('../controllers/authController');
const { autenticar } = require('../middleware/auth');

router.post('/login', login);
router.get('/me', autenticar, me);
router.post('/reset-senha', resetSenhaTemp);

module.exports = router;
