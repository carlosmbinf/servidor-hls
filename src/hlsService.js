const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegStaticPath = require('ffmpeg-static');
const config = require('./config');

const HLS_PLAYLIST_NAME = 'index.m3u8';
const movieHlsJobs = new Map();
const movieHlsMetadataPromises = new Map();
const activeDirectStreams = new Map();

function getFfmpegPath() {
  return config.ffmpegPath || ffmpegStaticPath || 'ffmpeg';
}

function sendJson(res, statusCode, payload) {
  res.status(statusCode).type('application/json; charset=utf-8').send(JSON.stringify(payload));
}

function getMovieHlsBaseUrl(idPeli, sessionId) {
  return `/peliculas/hls/${encodeURIComponent(idPeli)}/${encodeURIComponent(sessionId)}`;
}

function sanitizeCacheName(value = '') {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'movie';
}

function createMovieHlsSessionId() {
  return crypto.randomBytes(12).toString('hex');
}

function createRuntimeId() {
  return crypto.randomBytes(8).toString('hex');
}

function normalizeMovieHlsSessionId(value = '') {
  const normalized = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{8,80}$/.test(normalized) ? normalized : null;
}

function normalizeMovieHlsStartAt(value) {
  const parsedValue = Number(value || 0);
  if (!Number.isFinite(parsedValue) || parsedValue < 0) return 0;
  return Math.max(0, Math.floor(parsedValue));
}

function getRequestedMovieHlsSessionId(req) {
  return normalizeMovieHlsSessionId(req.params?.sessionId || req.query?.sessionId || req.headers?.['x-hls-session-id']);
}

function getMovieHlsContext(idPeli, videoUrl, sessionId = 'default') {
  const safeId = sanitizeCacheName(idPeli);
  const hash = crypto.createHash('sha1').update(`${idPeli}:${videoUrl}`).digest('hex').slice(0, 16);
  const movieCacheKey = `${safeId}-${hash}`;
  const cacheKey = `${movieCacheKey}-${sessionId}`;
  const movieDir = path.join(config.cacheDir, movieCacheKey);
  const dir = path.join(movieDir, sessionId);

  return {
    cacheKey,
    dir,
    movieCacheKey,
    movieDir,
    playlistPath: path.join(dir, HLS_PLAYLIST_NAME),
    readyPath: path.join(dir, 'ready.json'),
    errorPath: path.join(dir, 'error.json'),
    sessionInfoPath: path.join(dir, 'session.json'),
    metadataPath: path.join(movieDir, 'metadata.json'),
    sessionId,
    playlistUrl: `${getMovieHlsBaseUrl(idPeli, sessionId)}/${HLS_PLAYLIST_NAME}`,
  };
}

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return null;
  }
}

function parseFfmpegDuration(value = '') {
  const match = String(value).match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const durationSeconds = (hours * 3600) + (minutes * 60) + seconds;
  return Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : null;
}

async function probeMovieHlsMetadata(context, videoUrl) {
  const cachedMetadata = readJsonFile(context.metadataPath);
  if (cachedMetadata && cachedMetadata.videoUrl === videoUrl) {
    return { durationSeconds: Number(cachedMetadata.durationSeconds) || null };
  }

  const currentPromise = movieHlsMetadataPromises.get(context.movieCacheKey);
  if (currentPromise) return currentPromise;

  const probePromise = new Promise((resolve) => {
    fs.mkdirSync(context.movieDir, { recursive: true });
    const args = [
      '-hide_banner',
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-user_agent', 'VIDKAR-HLS-Probe/1.0',
      '-i', videoUrl,
    ];
    const probe = spawn(getFfmpegPath(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timeout = setTimeout(() => {
      try {
        if (!probe.killed) probe.kill('SIGKILL');
      } catch (_error) {
        // Best effort.
      }
    }, 15000);

    probe.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-12000);
    });

    probe.on('error', () => {
      clearTimeout(timeout);
      resolve({ durationSeconds: null });
    });

    probe.on('close', () => {
      clearTimeout(timeout);
      const durationSeconds = parseFfmpegDuration(stderr);
      try {
        fs.writeFileSync(context.metadataPath, JSON.stringify({ durationSeconds, probedAt: new Date().toISOString(), videoUrl }, null, 2));
      } catch (_error) {
        // Metadata persistence is optional.
      }
      resolve({ durationSeconds });
    });
  }).finally(() => {
    movieHlsMetadataPromises.delete(context.movieCacheKey);
  });

  movieHlsMetadataPromises.set(context.movieCacheKey, probePromise);
  return probePromise;
}

function countHlsSegments(dir) {
  try {
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter((fileName) => /^segment_\d+\.ts$/.test(fileName)).length;
  } catch (_error) {
    return 0;
  }
}

function appendRecentLine(lines, value, maxLines = 80) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) return lines;
  const nextLines = lines.concat(normalizedValue.split('\n').map((line) => line.trim()).filter(Boolean));
  return nextLines.slice(-maxLines);
}

function parseFfmpegProgressLine(job, line = '') {
  const separatorIndex = line.indexOf('=');
  if (separatorIndex <= 0) return;

  const key = line.slice(0, separatorIndex).trim();
  const value = line.slice(separatorIndex + 1).trim();
  if (!key) return;

  job.progress = {
    ...(job.progress || {}),
    [key]: value,
    updatedAt: new Date().toISOString(),
  };
}

function getProgressSeconds(progress = {}) {
  const outTimeMs = Number(progress.out_time_ms);
  if (Number.isFinite(outTimeMs) && outTimeMs > 0) return outTimeMs / 1000000;

  const outTimeUs = Number(progress.out_time_us);
  if (Number.isFinite(outTimeUs) && outTimeUs > 0) return outTimeUs / 1000000;

  const timeMatch = String(progress.out_time || '').match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
  if (!timeMatch) return null;
  return (Number(timeMatch[1]) * 3600) + (Number(timeMatch[2]) * 60) + Number(timeMatch[3]);
}

function getJobProgressSummary(job) {
  const progress = job.progress || {};
  const relativeSeconds = getProgressSeconds(progress);
  const absoluteSeconds = Number.isFinite(relativeSeconds) ? (Number(job.startAtSeconds || 0) + relativeSeconds) : null;
  const durationSeconds = Number(job.durationSeconds || 0) || null;
  const percent = durationSeconds && Number.isFinite(absoluteSeconds)
    ? Math.max(0, Math.min(100, (absoluteSeconds / durationSeconds) * 100))
    : null;

  return {
    bitrate: progress.bitrate || null,
    fps: progress.fps || null,
    frame: progress.frame || null,
    progress: progress.progress || null,
    relativeSeconds,
    absoluteSeconds,
    percent,
    speed: progress.speed || null,
    totalSize: progress.total_size || null,
    updatedAt: progress.updatedAt || null,
  };
}

function registerDirectStream({ idPeli, movieTitle, videoUrl, range, ip, userAgent }) {
  const streamId = createRuntimeId();
  activeDirectStreams.set(streamId, {
    id: streamId,
    idPeli,
    movieTitle: movieTitle || idPeli,
    videoUrl,
    range: range || null,
    ip: ip || null,
    userAgent: userAgent || null,
    startedAt: new Date().toISOString(),
    startedAtMs: Date.now(),
  });
  return streamId;
}

function unregisterDirectStream(streamId) {
  if (!streamId) return;
  activeDirectStreams.delete(streamId);
}

function getDirectStreamsSnapshot() {
  return Array.from(activeDirectStreams.values()).map((stream) => ({
    ...stream,
    uptimeMs: Date.now() - stream.startedAtMs,
  }));
}

function cleanupMovieHlsSession(context) {
  try {
    fs.rmSync(context.dir, { force: true, recursive: true });
  } catch (error) {
    console.warn('No se pudo limpiar cache HLS:', error?.message || error);
  }
}

function stopMovieHlsJob(context, reason = 'manual', cleanup = true) {
  const job = movieHlsJobs.get(context.cacheKey);
  if (!job) {
    if (cleanup) cleanupMovieHlsSession(context);
    return false;
  }

  job.stoppedReason = reason;
  job.cleanupOnStop = cleanup;
  if (job.idleTimer) clearTimeout(job.idleTimer);

  try {
    if (!job.process.killed) {
      job.process.kill('SIGTERM');
      job.killTimer = setTimeout(() => {
        if (!job.process.killed) job.process.kill('SIGKILL');
      }, config.hlsKillGraceMs);
    }
  } catch (error) {
    console.warn('No se pudo detener FFmpeg HLS:', error?.message || error);
  }

  return true;
}

function scheduleMovieHlsIdleStop(context, job) {
  if (!job) return;
  if (job.idleTimer) clearTimeout(job.idleTimer);
  job.idleTimer = setTimeout(() => {
    const currentJob = movieHlsJobs.get(context.cacheKey);
    if (!currentJob) return;
    const idleForMs = Date.now() - (currentJob.lastAccessAt || currentJob.startedAtMs || Date.now());
    if (idleForMs >= config.hlsIdleTimeoutMs) {
      console.log(`Deteniendo HLS por inactividad: ${context.cacheKey}`);
      stopMovieHlsJob(context, 'idle-timeout', true);
      return;
    }
    scheduleMovieHlsIdleStop(context, currentJob);
  }, config.hlsIdleTimeoutMs);
}

function touchMovieHlsJob(context) {
  const job = movieHlsJobs.get(context.cacheKey);
  if (!job) return;
  job.lastAccessAt = Date.now();
  scheduleMovieHlsIdleStop(context, job);
}

function getMovieHlsStatus(context) {
  const activeJob = movieHlsJobs.get(context.cacheKey);
  if (activeJob) touchMovieHlsJob(context);
  const segmentsCount = countHlsSegments(context.dir);
  const playlistReady = fs.existsSync(context.playlistPath) && segmentsCount > 0;
  const readyInfo = readJsonFile(context.readyPath);
  const errorInfo = readJsonFile(context.errorPath);
  const sessionInfo = readJsonFile(context.sessionInfoPath);
  const metadataInfo = readJsonFile(context.metadataPath);
  const startAtSeconds = Number(activeJob?.startAtSeconds ?? sessionInfo?.startAtSeconds ?? 0) || 0;
  const durationSeconds = Number(activeJob?.durationSeconds ?? sessionInfo?.durationSeconds ?? metadataInfo?.durationSeconds) || null;

  if (activeJob) {
    return {
      status: playlistReady ? 'processing' : 'starting',
      ready: playlistReady,
      playlistReady,
      playlistUrl: context.playlistUrl,
      sessionId: context.sessionId,
      segmentsCount,
      startAtSeconds,
      durationSeconds,
      startedAt: activeJob.startedAt,
      lastAccessAt: activeJob.lastAccessAt ? new Date(activeJob.lastAccessAt).toISOString() : activeJob.startedAt,
    };
  }

  if (readyInfo && playlistReady) {
    return {
      status: 'ready',
      ready: true,
      playlistReady: true,
      playlistUrl: context.playlistUrl,
      sessionId: context.sessionId,
      segmentsCount,
      startAtSeconds: Number(readyInfo.startAtSeconds ?? startAtSeconds) || 0,
      durationSeconds: Number(readyInfo.durationSeconds ?? durationSeconds) || null,
      completedAt: readyInfo.completedAt,
    };
  }

  if (errorInfo) {
    return {
      status: 'error',
      ready: false,
      playlistReady,
      playlistUrl: playlistReady ? context.playlistUrl : null,
      sessionId: context.sessionId,
      segmentsCount,
      startAtSeconds,
      durationSeconds,
      error: errorInfo.message || 'No se pudo convertir la pelicula',
      failedAt: errorInfo.failedAt,
    };
  }

  return {
    status: playlistReady ? 'ready' : 'idle',
    ready: playlistReady,
    playlistReady,
    playlistUrl: playlistReady ? context.playlistUrl : null,
    sessionId: context.sessionId,
    segmentsCount,
    startAtSeconds,
    durationSeconds,
  };
}

function cleanHlsOutputForRestart(context) {
  fs.mkdirSync(context.dir, { recursive: true });
  fs.readdirSync(context.dir).forEach((fileName) => {
    if (/^(index\.m3u8|index\.m3u8\.tmp|ready\.json|error\.json|session\.json|segment_\d+\.ts|segment_\d+\.ts\.tmp)$/.test(fileName)) {
      try {
        fs.unlinkSync(path.join(context.dir, fileName));
      } catch (_error) {
        // Stale files are overwritten by next conversion.
      }
    }
  });
}

function startMovieHlsConversion({ context, videoUrl, movieTitle, startAtSeconds = 0, durationSeconds = null }) {
  const currentStatus = getMovieHlsStatus(context);
  if (['ready', 'processing', 'starting'].includes(currentStatus.status)) return currentStatus;

  cleanHlsOutputForRestart(context);
  fs.writeFileSync(context.sessionInfoPath, JSON.stringify({ durationSeconds, sessionId: context.sessionId, startAtSeconds, startedAt: new Date().toISOString() }, null, 2));

  const args = [
    '-y',
    '-nostdin',
    '-hide_banner',
    '-loglevel', 'warning',
    '-progress', 'pipe:2',
    '-fflags', '+genpts',
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-user_agent', 'VIDKAR-HLS-Transcoder/1.0',
    '-re',
    ...(startAtSeconds > 0 ? ['-ss', String(startAtSeconds)] : []),
    '-i', videoUrl,
    '-map', '0:v:0?',
    '-map', '0:a:0?',
    '-sn',
    '-dn',
    '-map_metadata', '-1',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-profile:v', 'main',
    '-pix_fmt', 'yuv420p',
    '-sc_threshold', '0',
    '-force_key_frames', 'expr:gte(t,n_forced*6)',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ac', '2',
    '-max_muxing_queue_size', '1024',
    '-avoid_negative_ts', 'make_zero',
    '-f', 'hls',
    '-hls_time', '6',
    '-hls_list_size', '12',
    '-hls_delete_threshold', '2',
    '-hls_flags', 'delete_segments+independent_segments+temp_file',
    '-hls_segment_filename', 'segment_%05d.ts',
    context.playlistPath,
  ];

  const ffmpeg = spawn(getFfmpegPath(), args, { cwd: context.dir, stdio: ['ignore', 'ignore', 'pipe'] });
  const job = {
    process: ffmpeg,
    startedAt: new Date().toISOString(),
    startedAtMs: Date.now(),
    lastAccessAt: Date.now(),
    startAtSeconds,
    durationSeconds,
    dir: context.dir,
    movieTitle: movieTitle || context.cacheKey,
    playlistUrl: context.playlistUrl,
    sessionId: context.sessionId,
    stderr: '',
    recentOutput: [],
    progress: {},
    cleanupOnStop: false,
    idleTimer: null,
    killTimer: null,
    stoppedReason: '',
  };
  movieHlsJobs.set(context.cacheKey, job);
  scheduleMovieHlsIdleStop(context, job);
  console.log(`Preparando HLS: ${movieTitle || context.cacheKey} desde ${startAtSeconds}s`);

  ffmpeg.stderr.on('data', (chunk) => {
    const chunkText = chunk.toString();
    job.stderr = `${job.stderr}${chunkText}`.slice(-8000);
    job.recentOutput = appendRecentLine(job.recentOutput, chunkText);
    chunkText.split('\n').forEach((line) => parseFfmpegProgressLine(job, line.trim()));
  });

  ffmpeg.on('error', (error) => {
    const message = error?.message || 'No se pudo iniciar FFmpeg';
    fs.writeFileSync(context.errorPath, JSON.stringify({ message, failedAt: new Date().toISOString() }, null, 2));
    if (job.idleTimer) clearTimeout(job.idleTimer);
    if (job.killTimer) clearTimeout(job.killTimer);
    movieHlsJobs.delete(context.cacheKey);
    console.error('Error iniciando FFmpeg HLS:', message);
  });

  ffmpeg.on('close', (code) => {
    if (job.idleTimer) clearTimeout(job.idleTimer);
    if (job.killTimer) clearTimeout(job.killTimer);
    movieHlsJobs.delete(context.cacheKey);

    if (job.stoppedReason) {
      if (job.cleanupOnStop) cleanupMovieHlsSession(context);
      console.log(`HLS detenido (${job.stoppedReason}): ${movieTitle || context.cacheKey}`);
      return;
    }

    const playlistReady = fs.existsSync(context.playlistPath) && countHlsSegments(context.dir) > 0;
    if (code === 0 && playlistReady) {
      fs.writeFileSync(context.readyPath, JSON.stringify({ completedAt: new Date().toISOString(), durationSeconds, startAtSeconds }, null, 2));
      console.log(`HLS listo: ${movieTitle || context.cacheKey}`);
      return;
    }

    const message = job.stderr || `FFmpeg finalizo con codigo ${code}`;
    fs.writeFileSync(context.errorPath, JSON.stringify({ message, failedAt: new Date().toISOString() }, null, 2));
    console.error('Error de conversion HLS:', message);
  });

  return getMovieHlsStatus(context);
}

function getHlsRuntimeSnapshot() {
  const activeJobs = Array.from(movieHlsJobs.entries()).map(([cacheKey, job]) => ({
    cacheKey,
    durationSeconds: Number(job.durationSeconds || 0) || null,
    movieTitle: job.movieTitle,
    pid: job.process?.pid || null,
    playlistUrl: job.playlistUrl,
    progress: getJobProgressSummary(job),
    recentOutput: job.recentOutput || [],
    segmentsCount: countHlsSegments(job.dir),
    sessionId: job.sessionId,
    startAtSeconds: Number(job.startAtSeconds || 0),
    startedAt: job.startedAt,
    stoppedReason: job.stoppedReason || null,
    uptimeMs: Date.now() - (job.startedAtMs || Date.now()),
  }));

  return {
    activeDirectStreams: getDirectStreamsSnapshot(),
    activeFfmpegJobs: activeJobs,
    cacheDir: config.cacheDir,
    ffmpegPath: getFfmpegPath(),
    now: new Date().toISOString(),
    totals: {
      activeDirectStreams: activeDirectStreams.size,
      activeFfmpegJobs: movieHlsJobs.size,
      activeStreams: activeDirectStreams.size + movieHlsJobs.size,
    },
  };
}

function serveHlsFile(req, res, filePath, contentType, cacheControl) {
  if (!fs.existsSync(filePath)) return res.status(404).send('Segmento no disponible');

  const fileStream = fs.createReadStream(filePath);
  const closeStream = () => {
    if (fileStream.destroy) fileStream.destroy();
  };

  req.on('aborted', closeStream);
  res.on('close', closeStream);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', cacheControl);
  fileStream.on('error', () => {
    if (!res.headersSent) res.status(500);
    res.end();
  });
  return fileStream.pipe(res);
}

module.exports = {
  createMovieHlsSessionId,
  getMovieHlsContext,
  getMovieHlsStatus,
  getRequestedMovieHlsSessionId,
  normalizeMovieHlsStartAt,
  probeMovieHlsMetadata,
  registerDirectStream,
  sendJson,
  serveHlsFile,
  startMovieHlsConversion,
  stopMovieHlsJob,
  touchMovieHlsJob,
  cleanupMovieHlsSession,
  getHlsRuntimeSnapshot,
  unregisterDirectStream,
};