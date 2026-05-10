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

```bash
PORT=3010
METEOR_DDP_ENDPOINT=ws://www.vidkar.com:3000/websocket
HLS_CACHE_DIR=./.vidkar-cache/peliculas-hls
HLS_IDLE_TIMEOUT_MS=45000
FFMPEG_PATH=/usr/bin/ffmpeg # opcional; si no, usa ffmpeg-static
ALLOWED_ORIGINS=https://www.vidkar.com,http://localhost:3000 # opcional
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

```bash
pm2 start ecosystem.config.js
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