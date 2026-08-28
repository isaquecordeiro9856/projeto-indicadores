const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/glosas', require('./routes/glosas'));
app.use('/api/etapa', require('./routes/etapa'));
app.use('/api/pempfrg', require('./routes/pempfrg'));
app.use('/api/farmacia', require('./routes/farmacia'));
app.use('/api/centrocirurgico', require('./routes/centrocirurgico'));
app.use('/api/fisioterapia', require('./routes/fisioterapia'));

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
  console.log(`TASY Analytics rodando na porta ${PORT}`);
  console.log(`Frontend: http://localhost:${PORT}/login.html`);
});
