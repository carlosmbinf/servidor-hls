const config = require('./config');
const { callMeteor } = require('./meteorClient');
const {
  getVideoContentType,
  fetchSubtitleToVtt,
  isAllowedMovieStreamUrl,
  normalizeSubtitleToVtt,
} = require('./movieService');

async function getChapter(idCapitulo) {
  try {
    const chapter = await callMeteor('getCapituloParaStreaming', idCapitulo);
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

async function getChapterVideoForStreaming(idCapitulo) {
  const result = await getChapter(idCapitulo);
  if (result.error) return result;

  const videoUrl = result.chapter?.urlHTTPS || result.chapter?.url;
  if (!videoUrl || !isAllowedMovieStreamUrl(videoUrl)) {
    return { error: 'invalid-video', message: 'El capítulo no tiene un video reproducible.', status: 404 };
  }

  return { chapter: result.chapter, videoUrl };
}

async function normalizeChapterSubtitle(chapter) {
  const storedSubtitle = normalizeSubtitleToVtt(chapter?.textSubtitle || '');
  if (storedSubtitle) return storedSubtitle;
  if (!chapter?.subtitulo) return '';

  try {
    return await fetchSubtitleToVtt(chapter.subtitulo);
  } catch (error) {
    console.error('No se pudo obtener subtítulo remoto de capítulo:', error?.message || error);
    return '';
  }
}

module.exports = {
  getChapter,
  getChapterVideoForStreaming,
  getVideoContentType,
  normalizeChapterSubtitle,
};
