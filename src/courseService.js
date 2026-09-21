const config = require('./config');

function normalizeCourseStreamUrl(videoUrl = '') {
  try {
    const rawUrl = String(videoUrl || '').trim();
    const configuredOrigin = new URL(config.meteorHttpOrigin);
    const parsedUrl = new URL(rawUrl, configuredOrigin.origin);
    const normalizeHostname = (hostname) => String(hostname || '').toLowerCase().replace(/^www\./, '');
    const isLocalHost = ['localhost', '127.0.0.1'].includes(String(parsedUrl.hostname || '').toLowerCase());
    const isMeteorHost = normalizeHostname(parsedUrl.hostname) === normalizeHostname(configuredOrigin.hostname)
      && parsedUrl.port === configuredOrigin.port;
    if (!['http:', 'https:'].includes(parsedUrl.protocol) || (!isMeteorHost && !isLocalHost)) return null;
    if (!parsedUrl.pathname || parsedUrl.pathname === '/') return null;
    return `${configuredOrigin.origin}${parsedUrl.pathname}${parsedUrl.search}`;
  } catch (_error) {
    return null;
  }
}

function isAllowedCourseStreamUrl(videoUrl = '') {
  return Boolean(normalizeCourseStreamUrl(videoUrl));
}

function getCourseVideoContentType(videoUrl = '') {
  const normalizedUrl = String(videoUrl).split('?')[0].toLowerCase();
  if (normalizedUrl.endsWith('.mp4') || normalizedUrl.endsWith('.m4v')) return 'video/mp4';
  if (normalizedUrl.endsWith('.webm')) return 'video/webm';
  if (normalizedUrl.endsWith('.ogg') || normalizedUrl.endsWith('.ogv')) return 'video/ogg';
  return 'application/octet-stream';
}

function getCourseVideoForStreaming(videoUrl) {
  const normalizedUrl = normalizeCourseStreamUrl(videoUrl);
  if (!normalizedUrl) {
    return { error: 'invalid-video', message: 'La URL de la lección no es válida.', status: 403 };
  }
  return { videoUrl: normalizedUrl };
}

module.exports = {
  getCourseVideoContentType,
  getCourseVideoForStreaming,
  isAllowedCourseStreamUrl,
  normalizeCourseStreamUrl,
};
