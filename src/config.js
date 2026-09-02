const path = require('path');

const getDefaultMeteorHttpOrigin = () => String(process.env.METEOR_DDP_ENDPOINT || 'ws://localhost:3000/websocket')
  .replace(/^wss:/i, 'https:')
  .replace(/^ws:/i, 'http:')
  .replace(/\/websocket\/?$/i, '');

const isProduction = process.env.NODE_ENV === 'production';
const meteorDdpEndpoint = process.env.METEOR_DDP_ENDPOINT || 'ws://localhost:3000/websocket';
if (isProduction && !/^wss:\/\//i.test(meteorDdpEndpoint)) {
  throw new Error('METEOR_DDP_ENDPOINT debe usar wss:// en producción');
}

const config = {
  cacheDir: path.resolve(process.env.HLS_CACHE_DIR || path.join(process.cwd(), '.vidkar-cache', 'peliculas-hls')),
  seriesCacheDir: path.resolve(process.env.SERIES_HLS_CACHE_DIR || path.join(process.cwd(), '.vidkar-cache', 'series-hls')),
  ffmpegPath: process.env.FFMPEG_PATH || '',
  hlsIdleTimeoutMs: Number(process.env.HLS_IDLE_TIMEOUT_MS || 45000),
  hlsKillGraceMs: Number(process.env.HLS_KILL_GRACE_MS || 5000),
  meteorDdpEndpoint,
  meteorHttpOrigin: process.env.METEOR_HTTP_ORIGIN || getDefaultMeteorHttpOrigin(),
  port: Number(process.env.PORT || 3050),
  sessionMaxAgeMs: Number(process.env.ADMIN_SESSION_MAX_AGE_MS || 1000 * 60 * 60 * 8),
};

module.exports = config;