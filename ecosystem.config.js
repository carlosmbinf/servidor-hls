const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || 'servidor-hls-vidkar',
      script: process.env.PM2_SCRIPT || 'src/index.js',
      instances: process.env.PM2_INSTANCES || 1,
      autorestart: process.env.PM2_AUTORESTART === 'true',
      watch: process.env.PM2_WATCH === 'true',
      max_memory_restart: process.env.PM2_MAX_MEMORY_RESTART,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        METEOR_DDP_ENDPOINT: process.env.METEOR_DDP_ENDPOINT,
        METEOR_HTTP_ORIGIN: process.env.METEOR_HTTP_ORIGIN,
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
        HLS_CACHE_DIR: process.env.HLS_CACHE_DIR,
        SERIES_HLS_CACHE_DIR: process.env.SERIES_HLS_CACHE_DIR,
        HLS_IDLE_TIMEOUT_MS: process.env.HLS_IDLE_TIMEOUT_MS,
        HLS_KILL_GRACE_MS: process.env.HLS_KILL_GRACE_MS,
        FFMPEG_PATH: process.env.FFMPEG_PATH,
        HLS_PLAYBACK_SECRET: process.env.HLS_PLAYBACK_SECRET,
        ADMIN_SESSION_MAX_AGE_MS: process.env.ADMIN_SESSION_MAX_AGE_MS,
        ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
      }
    }
  ]
};