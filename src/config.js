const path = require('path');

const parseAllowedOrigins = (value = '') => String(value || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const config = {
  allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
  cacheDir: path.resolve(process.env.HLS_CACHE_DIR || path.join(process.cwd(), '.vidkar-cache', 'peliculas-hls')),
  ffmpegPath: process.env.FFMPEG_PATH || '',
  hlsIdleTimeoutMs: Number(process.env.HLS_IDLE_TIMEOUT_MS || 45000),
  hlsKillGraceMs: Number(process.env.HLS_KILL_GRACE_MS || 5000),
  meteorDdpEndpoint: process.env.METEOR_DDP_ENDPOINT || 'ws://localhost:3000/websocket',
  port: Number(process.env.PORT || 3050),
  sessionMaxAgeMs: Number(process.env.ADMIN_SESSION_MAX_AGE_MS || 1000 * 60 * 60 * 8),
  sessionSecret: process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET || 'vidkar-hls-dev-session-secret',
};

module.exports = config;