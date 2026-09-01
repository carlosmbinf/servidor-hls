module.exports = {
  apps: [
    {
      name: 'servidor-hls-vidkar',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1200M',
      env: {
        NODE_ENV: 'production',
        PORT: 3050,
        METEOR_DDP_ENDPOINT: process.env.METEOR_DDP_ENDPOINT,
        METEOR_HTTP_ORIGIN: process.env.METEOR_HTTP_ORIGIN,
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
        HLS_CACHE_DIR: './.vidkar-cache/peliculas-hls',
        SERIES_HLS_CACHE_DIR: './.vidkar-cache/series-hls',
        HLS_IDLE_TIMEOUT_MS: 45000,
        FFMPEG_PATH: '/usr/bin/ffmpeg',
        HLS_PLAYBACK_SECRET: process.env.HLS_PLAYBACK_SECRET,
        ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
      }
    }
  ]
};