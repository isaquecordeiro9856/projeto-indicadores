const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const path = require('path');
require('dotenv').config();

const logger = require('./config/logger');

if (process.env.NODE_ENV === 'production' && process.env.DEV_MODE === 'true') {
  logger.fatal('DEV_MODE=true não pode ser usado com NODE_ENV=production (bypass de autenticação).');
  process.exit(1);
}

const app = express();

// CSP desabilitada: frontend usa scripts/estilos inline (AngularJS). Demais
// headers de segurança do helmet (X-Content-Type-Options, HSTS, etc.) seguem ativos.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : true
}));
app.use(express.json());
app.use(pinoHttp({ logger }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/glosas', require('./routes/glosas'));
app.use('/api/etapa', require('./routes/etapa'));
app.use('/api/pempfrg', require('./routes/pempfrg'));
app.use('/api/farmacia', require('./routes/farmacia'));
app.use('/api/centrocirurgico', require('./routes/centrocirurgico'));
app.use('/api/fisioterapia', require('./routes/fisioterapia'));
app.use('/api/geral', require('./routes/geral'));

const frontendPath = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendPath));

app.get('/api/health', async (req, res) => {
  try {
    const pool = require('./config/database');
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', timestamp: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'login.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`TASY Analytics rodando na porta ${PORT}`);
  logger.info(`Frontend: http://172.16.28.90:${PORT}/login.html`);
});
