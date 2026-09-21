const config = require('./config');

function isAllowedCourseStreamUrl(videoUrl = '') {
  try {
    const parsedUrl = new URL(String(videoUrl));
    const configuredOrigin = new URL(config.meteorHttpOrigin);
    const normalizeHostname = (hostname) => String(hostname || '').toLowerCase().replace(/^www\./, '');
    return ['http:', 'https:'].includes(parsedUrl.protocol)
      && normalizeHostname(parsedUrl.hostname) === normalizeHostname(configuredOrigin.hostname)
      && parsedUrl.port === configuredOrigin.port
      && parsedUrl.pathname.startsWith('/cfs/files/');
  } catch (_error) {
    return false;
  }
}

function getCourseVideoContentType(videoUrl = '') {
  const normalizedUrl = String(videoUrl).split('?')[0].toLowerCase();
  if (normalizedUrl.endsWith('.mp4') || normalizedUrl.endsWith('.m4v')) return 'video/mp4';
  if (normalizedUrl.endsWith('.webm')) return 'video/webm';
  if (normalizedUrl.endsWith('.ogg') || normalizedUrl.endsWith('.ogv')) return 'video/ogg';
  return 'application/octet-stream';
}

function getCourseVideoForStreaming(videoUrl) {
  if (!isAllowedCourseStreamUrl(videoUrl)) {
    return { error: 'invalid-video', message: 'La URL de la lección no es válida.', status: 403 };
  }
  return { videoUrl: String(videoUrl).trim() };
}

module.exports = {
  getCourseVideoContentType,
  getCourseVideoForStreaming,
  isAllowedCourseStreamUrl,
};
