const express = require('express');
const router = express.Router();
const { login, me } = require('../controllers/authController');
const { autenticar } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');

router.post('/login', loginLimiter, login);
router.get('/me', autenticar, me);

module.exports = router;
