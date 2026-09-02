const express = require('express');
const config = require('./config');
const { connectMeteor } = require('./meteorClient');
const routes = require('./routes');

const app = express();

app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(routes);

app.use((error, _req, res, _next) => {
  console.error('Error HTTP no controlado:', error?.message || error);
  if (res.headersSent) return;
  res.status(500).json({ success: false, error: 'Error interno del servidor HLS' });
});

connectMeteor().catch((error) => {
  console.error('El servidor HLS arrancara, pero aun no conecto a Meteor:', error?.message || error);
});

app.listen(config.port, () => {
  console.log(`Servidor HLS VIDKAR escuchando en puerto ${config.port}`);
  console.log(`DDP Meteor: ${config.meteorDdpEndpoint}`);
  console.log(`Cache HLS: ${config.cacheDir}`);
});