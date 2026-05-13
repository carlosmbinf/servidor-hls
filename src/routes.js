const axios = require('axios');
const express = require('express');
const https = require('https');
const path = require('path');
const {
  cleanupMovieHlsSession,
  createMovieHlsSessionId,
  getMovieHlsContext,
  getMovieHlsStatus,
  getHlsRuntimeSnapshot,
  getRequestedMovieHlsSessionId,
  normalizeMovieHlsStartAt,
  probeMovieHlsMetadata,
  registerDirectStream,
  sendJson,
  serveHlsFile,
  startMovieHlsConversion,
  stopMovieHlsJob,
  touchMovieHlsJob,
  unregisterDirectStream,
} = require('./hlsService');
const { getMovie, getMovieVideoForStreaming, getVideoContentType, normalizeSubtitleToVtt } = require('./movieService');
const {
  authenticateAdmin,
  clearSessionCookie,
  createAdminSession,
  destroyAdminSession,
  requireAdminApi,
  requireAdminPage,
  setSessionCookie,
} = require('./auth');
const { renderAdminDashboardPage, renderAdminLoginPage } = require('./adminViews');

const router = express.Router();
const insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false });

function renderStreamingLandingPage() {
  const currentYear = new Date().getFullYear();

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Servicio Streaming de Vidkar</title>
  <style>
    :root {
      --bg: #061018;
      --surface: rgba(9, 23, 34, 0.9);
      --surface-soft: rgba(255, 255, 255, 0.055);
      --line: rgba(255, 255, 255, 0.1);
      --text: #f6f9fc;
      --muted: #9fb2c4;
      --accent: #31d894;
      --accent-strong: #a9f4cf;
      --warning: #f8c86c;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at 18% 10%, rgba(49, 216, 148, 0.2), transparent 28%),
        radial-gradient(circle at 80% 80%, rgba(61, 118, 255, 0.22), transparent 32%),
        linear-gradient(135deg, #03070b 0%, #07131d 48%, #0c1c2a 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px;
    }

    main {
      width: min(1040px, 100%);
      border: 1px solid var(--line);
      border-radius: 28px;
      background: var(--surface);
      box-shadow: 0 28px 90px rgba(0, 0, 0, 0.42);
      overflow: hidden;
      backdrop-filter: blur(18px);
    }

    .hero {
      padding: clamp(28px, 5vw, 58px);
      border-bottom: 1px solid var(--line);
    }

    .brand-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 34px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
    }

    .mark {
      width: 46px;
      height: 46px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      color: #042011;
      font-weight: 900;
      background: linear-gradient(135deg, var(--accent), #91f0c3);
      box-shadow: 0 12px 36px rgba(49, 216, 148, 0.28);
      flex: 0 0 auto;
    }

    .brand-title {
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .status {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      padding: 9px 13px;
      border: 1px solid rgba(49, 216, 148, 0.25);
      border-radius: 999px;
      color: var(--accent-strong);
      background: rgba(49, 216, 148, 0.1);
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--accent);
      box-shadow: 0 0 18px rgba(49, 216, 148, 0.9);
    }

    .eyebrow {
      margin: 0 0 14px;
      color: var(--accent-strong);
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      max-width: 820px;
      font-size: clamp(38px, 7vw, 78px);
      line-height: 1.02;
      font-weight: 900;
    }

    .lead {
      margin: 22px 0 0;
      max-width: 760px;
      color: var(--muted);
      font-size: clamp(17px, 2vw, 20px);
      line-height: 1.72;
    }

    .capabilities {
      padding: clamp(24px, 4vw, 42px);
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }

    .card {
      min-height: 160px;
      padding: 20px;
      border: 1px solid var(--line);
      border-radius: 20px;
      background: var(--surface-soft);
    }

    .icon {
      width: 38px;
      height: 38px;
      margin-bottom: 18px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      color: var(--accent-strong);
      background: rgba(49, 216, 148, 0.1);
      border: 1px solid rgba(49, 216, 148, 0.16);
      font-size: 18px;
      font-weight: 900;
    }

    .card strong {
      display: block;
      margin-bottom: 9px;
      font-size: 16px;
    }

    .card span {
      color: var(--muted);
      font-size: 14px;
      line-height: 1.6;
    }

    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 18px;
      padding: 20px clamp(24px, 4vw, 42px);
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 13px;
    }

    .footer a {
      color: var(--accent-strong);
      font-weight: 800;
      text-decoration: none;
    }

    @media (max-width: 860px) {
      body { padding: 18px; align-items: flex-start; }
      main { border-radius: 22px; }
      .brand-row, .footer { align-items: flex-start; flex-direction: column; }
      .capabilities { grid-template-columns: 1fr; }
      .brand-title, .status { white-space: normal; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero" aria-labelledby="page-title">
      <div class="brand-row">
        <div class="brand">
          <div class="mark" aria-hidden="true">V</div>
          <div class="brand-title">Vidkar Streaming</div>
        </div>
        <div class="status"><span class="status-dot" aria-hidden="true"></span> Servicio activo</div>
      </div>
      <p class="eyebrow">Infraestructura multimedia</p>
      <h1 id="page-title">Servicio Streaming de Vidkar</h1>
      <p class="lead">
        Este servidor forma parte de la infraestructura de video de Vidkar. Su funcion es preparar y entregar contenido audiovisual optimizado para reproduccion web mediante streaming HLS.
      </p>
    </section>

    <section class="capabilities" aria-label="Informacion del servicio">
      <article class="card">
        <div class="icon">01</div>
        <strong>Conversion HLS</strong>
        <span>Procesa formatos de video y genera listas de reproduccion con segmentos preparados para navegadores compatibles.</span>
      </article>
      <article class="card">
        <div class="icon">02</div>
        <strong>Entrega progresiva</strong>
        <span>Sirve playlists, segmentos y recursos multimedia bajo demanda para reducir carga sobre el backend principal.</span>
      </article>
      <article class="card">
        <div class="icon">03</div>
        <strong>Operacion dedicada</strong>
        <span>Superficie tecnica reservada para el ecosistema Vidkar, sus reproductores autorizados e integraciones internas.</span>
      </article>
    </section>

    <footer class="footer">
      <span>VIDKAR &copy; ${currentYear}. Servicio de streaming dedicado.</span>
      <a href="https://www.vidkar.com" rel="noopener noreferrer">Ir a Vidkar</a>
    </footer>
  </main>
</body>
</html>`;
}

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

router.get('/', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(renderStreamingLandingPage());
});

router.get('/admin/login', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(renderAdminLoginPage({ error: req.query?.error || '' }));
});

router.post('/admin/login', async (req, res) => {
  try {
    const user = await authenticateAdmin(req.body?.identifier, req.body?.password);
    const token = createAdminSession(user);
    setSessionCookie(req, res, token);
    res.redirect('/admin');
  } catch (error) {
    const message = encodeURIComponent(error?.message || 'No se pudo iniciar sesion');
    res.redirect(`/admin/login?error=${message}`);
  }
});

router.post('/admin/logout', (req, res) => {
  destroyAdminSession(req);
  clearSessionCookie(res);
  res.redirect('/admin/login');
});

router.get('/admin', requireAdminPage, (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(renderAdminDashboardPage({ user: req.adminSession.user }));
});

const sendRuntimeSnapshot = (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, ...getHlsRuntimeSnapshot() });
};

router.get('/api/runtime', sendRuntimeSnapshot);
router.get('/admin/api/runtime', sendRuntimeSnapshot);

router.get('/peliculas/stream/:idPeli', async (req, res) => {
  const idPeli = req.params?.idPeli || req.query?.idPeli || req.query?.id;
  let upstreamStream = null;
  let directStreamId = null;
  let streamClosed = false;

  if (!idPeli) return res.status(400).send('Debe enviar el id de la pelicula');

  try {
    const { pelicula, videoUrl, error } = await getMovieVideoForStreaming(idPeli);
    if (error) return res.status(404).send(error);

    const requestHeaders = req.headers.range ? { Range: req.headers.range } : {};
    const closeUpstream = () => {
      if (streamClosed) return;
      streamClosed = true;
      unregisterDirectStream(directStreamId);
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
    directStreamId = registerDirectStream({
      idPeli,
      movieTitle: pelicula?.nombrePeli,
      videoUrl,
      range: req.headers.range || null,
      ip: req.ip || req.socket?.remoteAddress || null,
      userAgent: req.headers['user-agent'] || null,
    });
    if (streamClosed) {
      unregisterDirectStream(directStreamId);
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
      unregisterDirectStream(directStreamId);
    });
    upstreamStream.on('error', (error) => {
      unregisterDirectStream(directStreamId);
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