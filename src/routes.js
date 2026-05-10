const axios = require('axios');
const express = require('express');
const https = require('https');
const path = require('path');
const {
  cleanupMovieHlsSession,
  createMovieHlsSessionId,
  getMovieHlsContext,
  getMovieHlsStatus,
  getRequestedMovieHlsSessionId,
  normalizeMovieHlsStartAt,
  probeMovieHlsMetadata,
  sendJson,
  serveHlsFile,
  startMovieHlsConversion,
  stopMovieHlsJob,
  touchMovieHlsJob,
} = require('./hlsService');
const { getMovie, getMovieVideoForStreaming, getVideoContentType, normalizeSubtitleToVtt } = require('./movieService');

const router = express.Router();
const insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false });

function isSuccessfulStreamStatus(status) {
  return status === 200 || status === 206;
}

function buildStreamErrorReport(error, context = {}) {
  return {
    name: error?.name || 'Error',
    message: error?.message || 'Error desconocido al preparar stream de pelicula',
    code: error?.code,
    status: error?.response?.status,
    statusText: error?.response?.statusText,
    method: error?.config?.method,
    url: error?.config?.url,
    hasRange: Boolean(error?.config?.headers?.Range),
    ...context,
  };
}

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'servidor-hls-vidkar', now: new Date().toISOString() });
});

router.get('/peliculas/stream/:idPeli', async (req, res) => {
  const idPeli = req.params?.idPeli || req.query?.idPeli || req.query?.id;
  let upstreamStream = null;
  let streamClosed = false;

  if (!idPeli) return res.status(400).send('Debe enviar el id de la pelicula');

  try {
    const { pelicula, videoUrl, error } = await getMovieVideoForStreaming(idPeli);
    if (error) return res.status(404).send(error);

    const requestHeaders = req.headers.range ? { Range: req.headers.range } : {};
    const closeUpstream = () => {
      if (streamClosed) return;
      streamClosed = true;
      if (upstreamStream?.destroy) upstreamStream.destroy();
    };

    req.on('aborted', closeUpstream);
    res.on('close', closeUpstream);

    const upstreamResponse = await axios({
      url: videoUrl,
      method: 'GET',
      responseType: 'stream',
      headers: requestHeaders,
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: isSuccessfulStreamStatus,
      httpsAgent: insecureHttpsAgent,
    });

    upstreamStream = upstreamResponse.data;
    if (streamClosed) {
      upstreamStream.destroy();
      return undefined;
    }

    res.status(upstreamResponse.status);
    res.setHeader('Content-Type', upstreamResponse.headers['content-type'] || getVideoContentType(videoUrl));
    res.setHeader('Accept-Ranges', upstreamResponse.headers['accept-ranges'] || 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    if (upstreamResponse.headers['content-length']) res.setHeader('Content-Length', upstreamResponse.headers['content-length']);
    if (upstreamResponse.headers['content-range']) res.setHeader('Content-Range', upstreamResponse.headers['content-range']);

    upstreamStream.on('end', () => {
      streamClosed = true;
    });
    upstreamStream.on('error', (error) => {
      console.error('Error al transmitir pelicula:', pelicula?.nombrePeli || idPeli, error?.message || error);
      if (!res.headersSent) res.status(502);
      res.end();
    });

    return upstreamStream.pipe(res);
  } catch (error) {
    const upstreamStatus = error?.response?.status;
    const errorReport = buildStreamErrorReport(error, { idPeli, range: req.headers.range || null });
    console.error('Error al preparar stream de pelicula:', errorReport);

    if (streamClosed || res.writableEnded) return undefined;

    return res.status(upstreamStatus || 500).send(upstreamStatus === 503
      ? 'El servidor de video no esta disponible en este momento'
      : 'Error al preparar la reproduccion');
  }
});

router.post('/peliculas/hls/:idPeli/prepare', async (req, res) => {
  const idPeli = req.params?.idPeli || req.query?.idPeli || req.query?.id;
  const sessionId = getRequestedMovieHlsSessionId(req) || createMovieHlsSessionId();
  let startAtSeconds = normalizeMovieHlsStartAt(req.query?.startAt || req.body?.startAt);

  if (!idPeli) return sendJson(res, 400, { success: false, error: 'Debe enviar el id de la pelicula' });

  try {
    const { pelicula, videoUrl, error } = await getMovieVideoForStreaming(idPeli);
    if (error) return sendJson(res, 404, { success: false, error });

    const context = getMovieHlsContext(idPeli, videoUrl, sessionId);
    const metadata = await probeMovieHlsMetadata(context, videoUrl);
    if (metadata.durationSeconds && startAtSeconds >= metadata.durationSeconds) {
      startAtSeconds = Math.max(0, Math.floor(metadata.durationSeconds) - 5);
    }

    const status = startMovieHlsConversion({
      context,
      durationSeconds: metadata.durationSeconds,
      videoUrl,
      movieTitle: pelicula?.nombrePeli,
      startAtSeconds,
    });

    return sendJson(res, 200, { success: true, ...status });
  } catch (error) {
    console.error('No se pudo preparar HLS:', buildStreamErrorReport(error, { idPeli, target: 'hls-prepare' }));
    return sendJson(res, 500, { success: false, error: 'No se pudo preparar la conversion de la pelicula' });
  }
});

router.get('/peliculas/hls/:idPeli/status', async (req, res) => {
  const idPeli = req.params?.idPeli || req.query?.idPeli || req.query?.id;
  const sessionId = getRequestedMovieHlsSessionId(req);

  if (!idPeli) return sendJson(res, 400, { success: false, error: 'Debe enviar el id de la pelicula' });
  if (!sessionId) return sendJson(res, 400, { success: false, error: 'Debe enviar la sesion de reproduccion' });

  try {
    const { videoUrl, error } = await getMovieVideoForStreaming(idPeli);
    if (error) return sendJson(res, 404, { success: false, error });

    const context = getMovieHlsContext(idPeli, videoUrl, sessionId);
    await probeMovieHlsMetadata(context, videoUrl);
    touchMovieHlsJob(context);
    return sendJson(res, 200, { success: true, ...getMovieHlsStatus(context) });
  } catch (error) {
    console.error('No se pudo consultar HLS:', buildStreamErrorReport(error, { idPeli, target: 'hls-status' }));
    return sendJson(res, 500, { success: false, error: 'No se pudo consultar el estado de conversion' });
  }
});

router.post('/peliculas/hls/:idPeli/:sessionId/cancel', async (req, res) => {
  const idPeli = req.params?.idPeli || req.query?.idPeli || req.query?.id;
  const sessionId = getRequestedMovieHlsSessionId(req);

  if (!idPeli || !sessionId) return sendJson(res, 400, { success: false, error: 'Debe enviar pelicula y sesion de reproduccion' });

  try {
    const { videoUrl, error } = await getMovieVideoForStreaming(idPeli);
    if (error) return sendJson(res, 404, { success: false, error });

    const context = getMovieHlsContext(idPeli, videoUrl, sessionId);
    const stopped = stopMovieHlsJob(context, 'client-cancel', true);
    if (!stopped) cleanupMovieHlsSession(context);
    return sendJson(res, 200, { success: true, stopped, sessionId });
  } catch (error) {
    console.error('No se pudo cancelar HLS:', buildStreamErrorReport(error, { idPeli, sessionId, target: 'hls-cancel' }));
    return sendJson(res, 500, { success: false, error: 'No se pudo cancelar la conversion de la pelicula' });
  }
});

router.get('/peliculas/hls/:idPeli/:sessionId/index.m3u8', async (req, res) => {
  const idPeli = req.params?.idPeli || req.query?.idPeli || req.query?.id;
  const sessionId = getRequestedMovieHlsSessionId(req);

  if (!idPeli || !sessionId) return res.status(400).send('Debe enviar pelicula y sesion de reproduccion');

  try {
    const { videoUrl, error } = await getMovieVideoForStreaming(idPeli);
    if (error) return res.status(404).send(error);

    const context = getMovieHlsContext(idPeli, videoUrl, sessionId);
    touchMovieHlsJob(context);
    const status = getMovieHlsStatus(context);
    if (!status.playlistReady) return res.status(425).send('La conversion HLS aun no tiene segmentos disponibles');

    return serveHlsFile(req, res, context.playlistPath, 'application/vnd.apple.mpegurl; charset=utf-8', status.status === 'ready' ? 'private, max-age=30' : 'no-store');
  } catch (error) {
    console.error('No se pudo servir playlist HLS:', buildStreamErrorReport(error, { idPeli, sessionId, target: 'hls-playlist' }));
    return res.status(500).send('No se pudo servir la playlist HLS');
  }
});

router.get('/peliculas/hls/:idPeli/:sessionId/:segmentName', async (req, res) => {
  const idPeli = req.params?.idPeli || req.query?.idPeli || req.query?.id;
  const sessionId = getRequestedMovieHlsSessionId(req);
  const segmentName = req.params?.segmentName;

  if (!idPeli || !sessionId || !/^segment_\d+\.ts$/.test(segmentName || '')) {
    return res.status(404).send('Segmento no encontrado');
  }

  try {
    const { videoUrl, error } = await getMovieVideoForStreaming(idPeli);
    if (error) return res.status(404).send(error);

    const context = getMovieHlsContext(idPeli, videoUrl, sessionId);
    touchMovieHlsJob(context);
    return serveHlsFile(req, res, path.join(context.dir, segmentName), 'video/mp2t', 'no-store');
  } catch (error) {
    console.error('No se pudo servir segmento HLS:', buildStreamErrorReport(error, { idPeli, sessionId, segmentName, target: 'hls-segment' }));
    return res.status(500).send('No se pudo servir el segmento HLS');
  }
});

router.get('/getsubtitle', async (req, res) => {
  try {
    const pelicula = await getMovie(req.query.idPeli || req.query.id);
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    return res.send(pelicula ? normalizeSubtitleToVtt(pelicula.textSubtitle) : '');
  } catch (error) {
    console.error('No se pudo obtener subtitulo:', error?.message || error);
    return res.status(500).send('');
  }
});

module.exports = router;