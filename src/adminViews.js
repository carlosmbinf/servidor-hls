function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderAdminLoginPage({ error = '' } = {}) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Admin HLS - Vidkar</title>
  <style>
    :root { --bg: #050914; --panel: rgba(15, 23, 42, 0.88); --line: rgba(148, 163, 184, 0.24); --text: #f8fafc; --muted: #a9b7ca; --accent: #38bdf8; --danger: #fb7185; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; font-family: Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: var(--text); background: radial-gradient(circle at 20% 10%, rgba(56,189,248,.18), transparent 30%), radial-gradient(circle at 85% 80%, rgba(34,197,94,.16), transparent 32%), linear-gradient(145deg, #020617, #08111f 55%, #0f172a); display: grid; place-items: center; padding: 24px; }
    .card { width: min(430px, 100%); border: 1px solid var(--line); border-radius: 24px; background: var(--panel); box-shadow: 0 24px 80px rgba(0,0,0,.42); padding: 28px; backdrop-filter: blur(18px); }
    .eyebrow { margin: 0 0 10px; color: var(--accent); font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(28px, 7vw, 40px); line-height: 1; }
    p { margin: 12px 0 24px; color: var(--muted); line-height: 1.55; }
    label { display: block; margin: 16px 0 8px; color: #dbeafe; font-size: 13px; font-weight: 700; }
    input { width: 100%; border: 1px solid var(--line); border-radius: 14px; background: rgba(2, 6, 23, .62); color: var(--text); padding: 14px 16px; font-size: 16px; outline: none; }
    input:focus { border-color: rgba(56,189,248,.75); box-shadow: 0 0 0 4px rgba(56,189,248,.12); }
    button { width: 100%; margin-top: 22px; border: 0; border-radius: 14px; background: linear-gradient(135deg, #38bdf8, #22c55e); color: #020617; padding: 14px 18px; font-size: 15px; font-weight: 900; cursor: pointer; }
    .error { margin: 18px 0 0; border: 1px solid rgba(251,113,133,.35); background: rgba(127, 29, 29, .35); color: #fecdd3; border-radius: 14px; padding: 12px 14px; }
    .link { display: inline-block; margin-top: 18px; color: var(--muted); text-decoration: none; font-size: 13px; }
  </style>
</head>
<body>
  <main class="card">
    <p class="eyebrow">Vidkar Streaming</p>
    <h1>Panel HLS</h1>
    <p>Entra con tu usuario Meteor administrador para revisar sesiones activas, conversiones FFmpeg y estado operativo del servicio.</p>
    <form method="post" action="/admin/login">
      <label for="identifier">Usuario o correo</label>
      <input id="identifier" name="identifier" autocomplete="username" required autofocus>
      <label for="password">Contrasena</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <button type="submit">Entrar como administrador</button>
    </form>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
    <a class="link" href="/">Volver al servicio streaming</a>
  </main>
</body>
</html>`;
}

function renderAdminDashboardPage({ user }) {
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'Administrador';
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Panel HLS - Vidkar</title>
  <style>
    :root { --bg: #020617; --panel: rgba(15, 23, 42, .92); --panel-2: rgba(30, 41, 59, .72); --line: rgba(148, 163, 184, .22); --text: #f8fafc; --muted: #a9b7ca; --accent: #38bdf8; --ok: #22c55e; --warn: #f59e0b; --danger: #fb7185; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; font-family: Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: var(--text); background: radial-gradient(circle at 12% 8%, rgba(56,189,248,.12), transparent 30%), radial-gradient(circle at 85% 0%, rgba(34,197,94,.12), transparent 28%), var(--bg); }
    header { position: sticky; top: 0; z-index: 10; border-bottom: 1px solid var(--line); background: rgba(2,6,23,.78); backdrop-filter: blur(18px); }
    .bar { width: min(1360px, 100%); margin: 0 auto; padding: 16px clamp(16px, 3vw, 30px); display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .mark { width: 38px; height: 38px; border-radius: 13px; background: linear-gradient(135deg, #38bdf8, #22c55e); box-shadow: 0 12px 34px rgba(56,189,248,.24); }
    h1 { margin: 0; font-size: 18px; }
    .sub { margin: 3px 0 0; color: var(--muted); font-size: 13px; }
    .logout { border: 1px solid var(--line); border-radius: 999px; background: rgba(15,23,42,.78); color: var(--text); padding: 9px 13px; cursor: pointer; }
    main { width: min(1360px, 100%); margin: 0 auto; padding: clamp(18px, 3vw, 34px); }
    .hero { border: 1px solid var(--line); border-radius: 24px; background: linear-gradient(135deg, rgba(15,23,42,.95), rgba(30,41,59,.72)); padding: clamp(20px, 4vw, 34px); box-shadow: 0 24px 70px rgba(0,0,0,.28); }
    .hero-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(280px, .8fr); gap: 18px; align-items: stretch; }
    .eyebrow { margin: 0 0 8px; color: var(--accent); text-transform: uppercase; letter-spacing: .12em; font-size: 12px; font-weight: 900; }
    .hero h2 { margin: 0; font-size: clamp(28px, 5vw, 48px); line-height: 1; }
    .hero p { color: var(--muted); line-height: 1.6; max-width: 720px; }
    .status-card { border: 1px solid var(--line); border-radius: 20px; background: rgba(2,6,23,.35); padding: 18px; }
    .status-line { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(148,163,184,.12); }
    .status-line:last-child { border-bottom: 0; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-top: 18px; }
    .metric, .panel { border: 1px solid var(--line); border-radius: 18px; background: var(--panel); padding: 18px; }
    .metric-label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; font-weight: 800; }
    .metric-value { margin-top: 8px; font-size: clamp(25px, 4vw, 38px); font-weight: 900; }
    .section { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(320px, .85fr); gap: 16px; margin-top: 18px; }
    .panel h3 { margin: 0 0 14px; font-size: 18px; }
    .list { display: grid; gap: 12px; }
    .job { border: 1px solid rgba(148,163,184,.16); border-radius: 16px; background: var(--panel-2); padding: 14px; }
    .job-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
    .job-toggle { appearance: none; width: 100%; border: 0; padding: 0; margin: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }
    .job-toggle:focus-visible { outline: 2px solid rgba(56,189,248,.75); outline-offset: 4px; border-radius: 12px; }
    .job-actions { display: flex; align-items: center; gap: 8px; }
    .job-hint { color: var(--muted); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .chevron { width: 28px; height: 28px; display: grid; place-items: center; border: 1px solid rgba(148,163,184,.2); border-radius: 999px; color: #dbeafe; background: rgba(2,6,23,.24); transition: transform .2s ease, background .2s ease; }
    .job.open .chevron { transform: rotate(180deg); background: rgba(56,189,248,.16); }
    .job-title { font-weight: 900; }
    .job-meta { color: var(--muted); font-size: 12px; margin-top: 4px; overflow-wrap: anywhere; }
    .job-summary { margin-top: 12px; }
    .job-details { display: none; margin-top: 12px; }
    .job.open .job-details { display: block; }
    .pill { border-radius: 999px; padding: 5px 9px; font-size: 12px; font-weight: 900; white-space: nowrap; }
    .pill.ok { background: rgba(34,197,94,.16); color: #bbf7d0; }
    .pill.warn { background: rgba(245,158,11,.16); color: #fde68a; }
    .bar-track { height: 8px; border-radius: 999px; background: rgba(15,23,42,.8); overflow: hidden; margin: 12px 0; }
    .bar-fill { height: 100%; border-radius: inherit; width: 0%; background: linear-gradient(90deg, #38bdf8, #22c55e); transition: width .25s ease; }
    .kv { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .kv div { border-radius: 12px; background: rgba(2,6,23,.28); padding: 9px; }
    .kv span { display: block; color: var(--muted); font-size: 11px; }
    .kv strong { display: block; margin-top: 3px; font-size: 13px; overflow-wrap: anywhere; }
    pre { margin: 12px 0 0; max-height: 220px; overflow: auto; border-radius: 14px; background: #010409; color: #d1fae5; padding: 12px; font-size: 12px; line-height: 1.45; white-space: pre-wrap; }
    .empty { color: var(--muted); border: 1px dashed var(--line); border-radius: 16px; padding: 18px; text-align: center; }
    @media (max-width: 980px) { .hero-grid, .section { grid-template-columns: 1fr; } .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 560px) { .grid, .kv { grid-template-columns: 1fr; } .bar { align-items: flex-start; flex-direction: column; } .logout { width: 100%; } }
  </style>
</head>
<body>
  <header>
    <div class="bar">
      <div class="brand"><div class="mark"></div><div><h1>Panel HLS Vidkar</h1><p class="sub">Sesion: ${escapeHtml(displayName)} (@${escapeHtml(user?.username || '')})</p></div></div>
      <form method="post" action="/admin/logout"><button class="logout" type="submit">Cerrar sesion</button></form>
    </div>
  </header>
  <main>
    <section class="hero">
      <div class="hero-grid">
        <div><p class="eyebrow">Monitoreo en tiempo real</p><h2>Streaming, conversiones FFmpeg y sesiones activas.</h2><p>Esta vista consulta el runtime local del servidor HLS. No modifica peliculas ni procesos; solo expone el estado operativo para administracion.</p></div>
        <div class="status-card" id="service-card"><div class="status-line"><span>Estado</span><strong id="service-status">Conectando...</strong></div><div class="status-line"><span>Ultima lectura</span><strong id="last-refresh">-</strong></div><div class="status-line"><span>FFmpeg</span><strong id="ffmpeg-path">-</strong></div></div>
      </div>
      <div class="grid">
        <div class="metric"><div class="metric-label">Streams activos</div><div class="metric-value" id="metric-streams">0</div></div>
        <div class="metric"><div class="metric-label">FFmpeg activos</div><div class="metric-value" id="metric-ffmpeg">0</div></div>
        <div class="metric"><div class="metric-label">Streams directos</div><div class="metric-value" id="metric-direct">0</div></div>
        <div class="metric"><div class="metric-label">Segmentos HLS</div><div class="metric-value" id="metric-segments">0</div></div>
      </div>
    </section>
    <section class="section">
      <div class="panel"><h3>Conversiones HLS / FFmpeg</h3><div class="list" id="ffmpeg-list"><div class="empty">Esperando datos...</div></div></div>
      <div class="panel"><h3>Streams directos</h3><div class="list" id="direct-list"><div class="empty">No hay streams directos activos.</div></div></div>
    </section>
  </main>
  <script>
    const $ = (id) => document.getElementById(id);
    const expandedFfmpegJobs = new Set();
    const expandedDirectStreams = new Set();
    const formatMs = (ms) => {
      const seconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return h > 0 ? h + 'h ' + m + 'm ' + s + 's' : m > 0 ? m + 'm ' + s + 's' : s + 's';
    };
    const safeText = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
    const shortUrl = (value) => {
      try { const url = new URL(value); return url.hostname + url.pathname.slice(0, 42); } catch (_error) { return value || '-'; }
    };
    function renderFfmpegJobs(jobs) {
      if (!jobs.length) return '<div class="empty">No hay conversiones FFmpeg activas ahora.</div>';
      return jobs.map((job) => {
        const jobKey = safeText(job.runtimeId || job.sessionId || job.cacheKey || job.pid || 'ffmpeg');
        const isOpen = expandedFfmpegJobs.has(jobKey);
        const percent = Number.isFinite(job.progress?.percent) ? Math.round(job.progress.percent * 10) / 10 : null;
        const output = Array.isArray(job.recentOutput) ? job.recentOutput.slice(-18).join('\\n') : '';
        return '<article class="job ' + (isOpen ? 'open' : '') + '">' +
          '<button class="job-toggle" type="button" data-kind="ffmpeg" data-key="' + jobKey + '" aria-expanded="' + (isOpen ? 'true' : 'false') + '">' +
            '<div class="job-head"><div><div class="job-title">' + safeText(job.movieTitle || job.cacheKey) + '</div><div class="job-meta">Sesion ' + safeText(job.sessionId) + ' · PID ' + safeText(job.pid || '-') + ' · ' + formatMs(job.uptimeMs) + '</div></div><div class="job-actions"><span class="job-hint">' + (isOpen ? 'Ocultar' : 'Ver detalle') + '</span><span class="pill ok">FFmpeg</span><span class="chevron">⌄</span></div></div>' +
            '<div class="bar-track"><div class="bar-fill" style="width:' + (percent ?? 0) + '%"></div></div>' +
          '</button>' +
          '<div class="job-summary"><div class="kv"><div><span>Progreso</span><strong>' + (percent == null ? '-' : percent + '%') + '</strong></div><div><span>Velocidad</span><strong>' + safeText(job.progress?.speed || '-') + '</strong></div><div><span>FPS</span><strong>' + safeText(job.progress?.fps || '-') + '</strong></div><div><span>Segmentos</span><strong>' + safeText(job.segmentsCount ?? 0) + '</strong></div></div></div>' +
          '<div class="job-details">' + (output ? '<pre>' + safeText(output) + '</pre>' : '<div class="empty">Sin salida reciente de FFmpeg.</div>') + '</div>' +
          '</article>';
      }).join('');
    }
    function renderDirectStreams(streams) {
      if (!streams.length) return '<div class="empty">No hay streams directos activos.</div>';
      return streams.map((stream) => {
        const streamKey = safeText(stream.id || stream.streamId || stream.idPeli || 'direct');
        const isOpen = expandedDirectStreams.has(streamKey);
        return '<article class="job ' + (isOpen ? 'open' : '') + '">' +
          '<button class="job-toggle" type="button" data-kind="direct" data-key="' + streamKey + '" aria-expanded="' + (isOpen ? 'true' : 'false') + '">' +
            '<div class="job-head"><div><div class="job-title">' + safeText(stream.movieTitle || stream.idPeli) + '</div><div class="job-meta">' + safeText(stream.range || 'sin rango') + ' · ' + formatMs(stream.uptimeMs) + '</div></div><div class="job-actions"><span class="job-hint">' + (isOpen ? 'Ocultar' : 'Ver detalle') + '</span><span class="pill warn">Directo</span><span class="chevron">⌄</span></div></div>' +
          '</button>' +
          '<div class="job-details"><div class="job-meta">' + safeText(shortUrl(stream.videoUrl)) + '</div></div>' +
          '</article>';
      }).join('');
    }
    async function refreshRuntime() {
      try {
        const response = await fetch('/admin/api/runtime', { credentials: 'same-origin' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        const ffmpegJobs = data.activeFfmpegJobs || [];
        const directStreams = data.activeDirectStreams || [];
        $('service-status').textContent = 'Activo';
        $('last-refresh').textContent = new Date(data.now).toLocaleTimeString();
        $('ffmpeg-path').textContent = data.ffmpegPath || '-';
        $('metric-streams').textContent = data.totals?.activeStreams ?? 0;
        $('metric-ffmpeg').textContent = data.totals?.activeFfmpegJobs ?? 0;
        $('metric-direct').textContent = data.totals?.activeDirectStreams ?? 0;
        $('metric-segments').textContent = ffmpegJobs.reduce((sum, job) => sum + (Number(job.segmentsCount) || 0), 0);
        $('ffmpeg-list').innerHTML = renderFfmpegJobs(ffmpegJobs);
        $('direct-list').innerHTML = renderDirectStreams(directStreams);
      } catch (error) {
        $('service-status').textContent = 'Sin respuesta';
        $('last-refresh').textContent = new Date().toLocaleTimeString();
      }
    }
    document.addEventListener('click', (event) => {
      const button = event.target.closest('.job-toggle');
      if (!button) return;
      const key = button.dataset.key;
      const store = button.dataset.kind === 'direct' ? expandedDirectStreams : expandedFfmpegJobs;
      if (store.has(key)) store.delete(key); else store.add(key);
      refreshRuntime();
    });
    refreshRuntime();
    setInterval(refreshRuntime, 2000);
  </script>
</body>
</html>`;
}

module.exports = {
  renderAdminDashboardPage,
  renderAdminLoginPage,
};
