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
        PORT: 3010,
        METEOR_DDP_ENDPOINT: 'ws://www.vidkar.com:3000/websocket',
        HLS_CACHE_DIR: './.vidkar-cache/peliculas-hls',
        HLS_IDLE_TIMEOUT_MS: 45000
      }
    }
  ]
};