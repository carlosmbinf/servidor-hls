const { callMeteor } = require('./meteorClient');

function isAllowedMovieStreamUrl(videoUrl = '') {
  try {
    const parsedUrl = new URL(videoUrl);
    return ['http:', 'https:'].includes(parsedUrl.protocol);
  } catch (_error) {
    return false;
  }
}

function getVideoContentType(videoUrl = '') {
  const normalizedUrl = String(videoUrl).split('?')[0].toLowerCase();

  if (normalizedUrl.endsWith('.mp4') || normalizedUrl.endsWith('.m4v')) return 'video/mp4';
  if (normalizedUrl.endsWith('.webm')) return 'video/webm';
  if (normalizedUrl.endsWith('.ogg') || normalizedUrl.endsWith('.ogv')) return 'video/ogg';
  if (normalizedUrl.endsWith('.mkv')) return 'video/x-matroska';
  if (normalizedUrl.endsWith('.avi')) return 'video/x-msvideo';

  return 'application/octet-stream';
}

function normalizeSubtitleToVtt(subtitle = '') {
  const normalizedSubtitle = String(subtitle || '').replace(/^\uFEFF/, '').trimStart();
  if (!normalizedSubtitle) return '';
  if (/^WEBVTT/i.test(normalizedSubtitle)) return normalizedSubtitle;

  return `WEBVTT\n\n${normalizedSubtitle
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}`;
}

async function getMovie(idPeli) {
  if (!idPeli) return null;
  return callMeteor('getPelicula', idPeli);
}

async function getMovieVideoForStreaming(idPeli) {
  const pelicula = await getMovie(idPeli);
  const videoUrl = pelicula?.urlPeliHTTPS || pelicula?.urlPeli;

  if (!pelicula || !videoUrl || !isAllowedMovieStreamUrl(videoUrl)) {
    return { error: 'La pelicula no tiene un video reproducible' };
  }

  return { pelicula, videoUrl };
}

module.exports = {
  getMovie,
  getMovieVideoForStreaming,
  getVideoContentType,
  isAllowedMovieStreamUrl,
  normalizeSubtitleToVtt,
};