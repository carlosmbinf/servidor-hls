# Servidor HLS VIDKAR

Servidor Node independiente para sacar la conversion HLS del backend Meteor principal. Mantiene las mismas rutas de reproduccion usadas por la web:

- `GET /peliculas/stream/:idPeli`
- `POST /peliculas/hls/:idPeli/prepare?sessionId=...&startAt=...`
- `GET /peliculas/hls/:idPeli/status?sessionId=...`
- `POST /peliculas/hls/:idPeli/:sessionId/cancel`
- `GET /peliculas/hls/:idPeli/:sessionId/index.m3u8`
- `GET /peliculas/hls/:idPeli/:sessionId/segment_00000.ts`
- `GET /getsubtitle?idPeli=...`

## Como se conecta a VIDKAR

El servicio se conecta al backend Meteor por DDP usando `simpleddp`, igual que `configDataplusfromVidkar`. Para conocer la informacion de la pelicula llama al metodo Meteor existente:

```js
server.call('getPelicula', idPeli)
```

Con eso obtiene `urlPeliHTTPS`, `urlPeli`, `extension`, `nombrePeli` y `textSubtitle` sin abrir una conexion Mongo directa desde este servidor.

## Variables de entorno

PM2 carga automáticamente las variables desde `.env` al ejecutar `pm2 start ecosystem.config.js`.
Puedes copiar `.env.example` como `.env` y completar los valores:

```bash
PM2_APP_NAME=servidor-hls-vidkar
PM2_SCRIPT=src/index.js
PM2_INSTANCES=1
PM2_AUTORESTART=true
PM2_WATCH=false
PM2_MAX_MEMORY_RESTART=1200M
NODE_ENV=production
PORT=3010
METEOR_DDP_ENDPOINT=ws://38sljhvg-3000.brs.devtunnels.ms/websocket
METEOR_HTTP_ORIGIN=http://localhost:3000
HLS_CACHE_DIR=./.vidkar-cache/peliculas-hls
SERIES_HLS_CACHE_DIR=./.vidkar-cache/series-hls
HLS_IDLE_TIMEOUT_MS=45000
HLS_KILL_GRACE_MS=5000
FFMPEG_PATH=/usr/bin/ffmpeg # opcional; si no, usa ffmpeg-static
ALLOWED_ORIGINS=https://www.vidkar.com,http://localhost:3000 # opcional
HLS_PLAYBACK_SECRET=change-this-secret
ADMIN_SESSION_MAX_AGE_MS=28800000
ADMIN_SESSION_SECRET=change-this-secret
```

## Arranque local

```bash
npm install
npm start
```

Healthcheck:

```bash
curl http://localhost:3010/health
```

## PM2

`pm2 start` sin argumentos no puede saber qué script debe ejecutar. Usa el archivo
de configuración del proyecto (o el comando equivalente de npm):

```bash
pm2 start ecosystem.config.js
# equivalente:
npm run start:pm2
pm2 logs servidor-hls-vidkar
```

## Integracion con la web

El proyecto Meteor puede seguir conservando sus rutas actuales. Para aliviar carga, la web puede apuntar las rutas HLS al nuevo host manteniendo el mismo path.

En `settings.json` de Meteor se puede configurar:

```json
{
	"public": {
		"hlsServerUrl": "https://hls.vidkar.com"
	}
}
```

Con esa propiedad, el player web usara:

```text
https://hls.vidkar.com/peliculas/hls/<id>/prepare
https://hls.vidkar.com/peliculas/stream/<id>
```

Mientras se migra gradualmente, el backend Meteor no se elimina ni se rompe; este servicio replica el comportamiento para poder mover la carga a otro servidor.