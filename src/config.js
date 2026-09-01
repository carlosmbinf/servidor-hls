const path = require('path');

const getDefaultMeteorHttpOrigin = () => String(process.env.METEOR_DDP_ENDPOINT || 'ws://localhost:3000/websocket')
  .replace(/^wss:/i, 'https:')
  .replace(/^ws:/i, 'http:')
  .replace(/\/websocket\/?$/i, '');

const parseAllowedOrigins = (value = '') => String(value || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isProduction = process.env.NODE_ENV === 'production';
const getSecret = (name, fallback) => {
  const value = process.env[name] || '';
  if (isProduction && !value) {
    throw new Error(`${name} no está configurado en producción`);
  }
  return value || fallback;
};

const meteorDdpEndpoint = process.env.METEOR_DDP_ENDPOINT || 'ws://localhost:3000/websocket';
if (isProduction && !/^wss:\/\//i.test(meteorDdpEndpoint)) {
  throw new Error('METEOR_DDP_ENDPOINT debe usar wss:// en producción');
}

const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
if (isProduction && allowedOrigins.length === 0) {
  throw new Error('ALLOWED_ORIGINS debe incluir al menos un origen en producción');
}

const config = {
  allowedOrigins,
  cacheDir: path.resolve(process.env.HLS_CACHE_DIR || path.join(process.cwd(), '.vidkar-cache', 'peliculas-hls')),
  seriesCacheDir: path.resolve(process.env.SERIES_HLS_CACHE_DIR || path.join(process.cwd(), '.vidkar-cache', 'series-hls')),
  ffmpegPath: process.env.FFMPEG_PATH || '',
  hlsIdleTimeoutMs: Number(process.env.HLS_IDLE_TIMEOUT_MS || 45000),
  hlsKillGraceMs: Number(process.env.HLS_KILL_GRACE_MS || 5000),
  meteorDdpEndpoint,
  meteorHttpOrigin: process.env.METEOR_HTTP_ORIGIN || getDefaultMeteorHttpOrigin(),
  port: Number(process.env.PORT || 3050),
  playbackSecret: getSecret('HLS_PLAYBACK_SECRET', 'vidkar-hls-dev-playback-secret'),
  sessionMaxAgeMs: Number(process.env.ADMIN_SESSION_MAX_AGE_MS || 1000 * 60 * 60 * 8),
  sessionSecret: getSecret('ADMIN_SESSION_SECRET', 'vidkar-hls-dev-session-secret'),
};

module.exports = config;