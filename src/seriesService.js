const crypto = require('crypto');
const config = require('./config');
const { callMeteor } = require('./meteorClient');
const {
  getVideoContentType,
  isAllowedMovieStreamUrl,
  normalizeSubtitleToVtt,
} = require('./movieService');

function verifySeriesPlaybackToken(token, idCapitulo) {
  const [encodedPayload, signature] = String(token || '').split('.');
  if (!encodedPayload || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return null;

  const expectedSignature = crypto
    .createHmac('sha256', config.playbackSecret)
    .update(encodedPayload)
    .digest('hex');
  if (signature.length !== expectedSignature.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;

  try {
    const payload = JSON.parse(Buffer.from(
      encodedPayload.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf8'));
    if (
      payload?.scope !== 'series-playback'
      || payload?.idCapitulo !== idCapitulo
      || !payload?.userId
      || !Number.isFinite(Number(payload.exp))
      || Number(payload.exp) <= Math.floor(Date.now() / 1000)
    ) return null;
    return payload;
  } catch (_error) {
    return null;
  }
}

function getSeriesPlaybackToken(req) {
  const authorization = String(req.headers?.authorization || '');
  const bearerToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  return String(
    req.headers?.['x-series-playback-token']
      || req.query?.playbackToken
      || bearerToken
      || '',
  ).trim();
}

async function getChapter(idCapitulo, playbackToken) {
  if (!verifySeriesPlaybackToken(playbackToken, idCapitulo)) {
    return { error: 'not-authorized', message: 'La autorización de reproducción no es válida o expiró.', status: 401 };
  }

  try {
    const chapter = await callMeteor('getCapituloParaStreaming', idCapitulo, playbackToken);
    return chapter
      ? { chapter }
      : { error: 'not-found', message: 'El capítulo no está disponible.', status: 404 };
  } catch (error) {
    const code = error?.error || error?.code;
    if (code === 'not-authorized' || code === 'subscription-required') {
      return { error: 'not-authorized', message: 'La autorización de reproducción no es válida o expiró.', status: 401 };
    }
    throw error;
  }
}

async function getChapterVideoForStreaming(idCapitulo, playbackToken) {
  const result = await getChapter(idCapitulo, playbackToken);
  if (result.error) return result;

  const videoUrl = result.chapter?.urlHTTPS || result.chapter?.url;
  if (!videoUrl || !isAllowedMovieStreamUrl(videoUrl)) {
    return { error: 'invalid-video', message: 'El capítulo no tiene un video reproducible.', status: 404 };
  }

  return { chapter: result.chapter, videoUrl };
}

function normalizeChapterSubtitle(chapter) {
  return normalizeSubtitleToVtt(chapter?.textSubtitle || '');
}

module.exports = {
  getChapter,
  getChapterVideoForStreaming,
  getSeriesPlaybackToken,
  getVideoContentType,
  normalizeChapterSubtitle,
  verifySeriesPlaybackToken,
};
