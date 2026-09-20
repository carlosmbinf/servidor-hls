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
  hlsIdleTimeoutMs: Number(process.env.HLS_IDLE_TIMEOUT_MS || 60000),
  hlsKillGraceMs: Number(process.env.HLS_KILL_GRACE_MS || 10000),
  upstreamTimeoutMs: Number(process.env.HLS_UPSTREAM_TIMEOUT_MS || 30000),
  probeTimeoutMs: Number(process.env.HLS_PROBE_TIMEOUT_MS || 30000),
  meteorConnectTimeoutMs: Number(process.env.METEOR_CONNECT_TIMEOUT_MS || 30000),
  meteorDdpEndpoint,
  meteorHttpOrigin: process.env.METEOR_HTTP_ORIGIN || getDefaultMeteorHttpOrigin(),
  runtimeToken: process.env.HLS_RUNTIME_TOKEN || '',
  port: Number(process.env.PORT || 3050),
  sessionMaxAgeMs: Number(process.env.ADMIN_SESSION_MAX_AGE_MS || 1000 * 60 * 60 * 8),
};

module.exports = config;