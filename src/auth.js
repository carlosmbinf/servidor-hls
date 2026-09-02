const crypto = require('crypto');
const config = require('./config');
const { callMeteor, server } = require('./meteorClient');

const ADMIN_COOKIE_NAME = 'vidkar_hls_admin';
const sessions = new Map();

function hashPassword(password = '') {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

function parseCookies(cookieHeader = '') {
  return String(cookieHeader || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) return cookies;
      const key = decodeURIComponent(part.slice(0, separatorIndex).trim());
      const value = decodeURIComponent(part.slice(separatorIndex + 1).trim());
      cookies[key] = value;
      return cookies;
    }, {});
}

function createSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getSessionFromRequest(req) {
  const token = parseCookies(req.headers.cookie)[ADMIN_COOKIE_NAME];
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return session;
}

function setSessionCookie(req, res, token) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const maxAgeSeconds = Math.floor(config.sessionMaxAgeMs / 1000);
  const cookieParts = [
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) cookieParts.push('Secure');
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

async function fetchLoggedUser(userId) {
  const userSub = server.subscribe('user', { _id: userId }, {
    fields: {
      username: 1,
      'profile.firstName': 1,
      'profile.lastName': 1,
      'profile.role': 1,
      picture: 1,
    },
  });

  try {
    await userSub.ready();
    return server.collection('users').filter((item) => item.id === userId).fetch()[0] || null;
  } finally {
    if (userSub.remove) userSub.remove();
    else if (userSub.stop) userSub.stop();
  }
}

async function authenticateAdmin(identifier, password) {
  const normalizedIdentifier = String(identifier || '').trim();
  const normalizedPassword = String(password || '');
  if (!normalizedIdentifier || !normalizedPassword) {
    throw new Error('Escribe usuario y contrasena.');
  }

  const userSelector = normalizedIdentifier.includes('@')
    ? { email: normalizedIdentifier }
    : { username: normalizedIdentifier };

  let loginResult;
  try {
    loginResult = await callMeteor('login', {
      user: userSelector,
      password: { digest: hashPassword(normalizedPassword), algorithm: 'sha-256' },
    });
  } catch (_error) {
    loginResult = await callMeteor('login', {
      user: userSelector,
      password: normalizedPassword,
    });
  }

  const userId = loginResult?.id;
  if (!userId) throw new Error('No se pudo iniciar sesion con esas credenciales.');

  const user = await fetchLoggedUser(userId);
  if (user?.profile?.role !== 'admin') {
    throw new Error('Solo los administradores pueden entrar al panel HLS.');
  }

  return {
    id: userId,
    username: user.username,
    firstName: user.profile?.firstName || '',
    lastName: user.profile?.lastName || '',
    role: user.profile?.role,
    loginToken: loginResult.token || null,
  };
}

function createAdminSession(user) {
  const token = createSessionToken();
  sessions.set(token, {
    user,
    createdAt: Date.now(),
    expiresAt: Date.now() + config.sessionMaxAgeMs,
  });
  return token;
}

function destroyAdminSession(req) {
  const token = parseCookies(req.headers.cookie)[ADMIN_COOKIE_NAME];
  if (token) sessions.delete(token);
}

function requireAdminPage(req, res, next) {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.redirect('/admin/login');
    return;
  }
  fetchLoggedUser(session.user.id)
    .then((user) => {
      if (!user || user.profile?.role !== 'admin') {
        destroyAdminSession(req);
        res.redirect('/admin/login');
        return;
      }
      session.user = { ...session.user, ...user, id: user.id || session.user.id };
      req.adminSession = session;
      next();
    })
    .catch(() => {
      res.redirect('/admin/login');
    });
}

function requireAdminApi(req, res, next) {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ success: false, error: 'Sesion requerida' });
    return;
  }
  fetchLoggedUser(session.user.id)
    .then((user) => {
      if (!user || user.profile?.role !== 'admin') {
        destroyAdminSession(req);
        res.status(401).json({ success: false, error: 'Sesion no autorizada' });
        return;
      }
      session.user = { ...session.user, ...user, id: user.id || session.user.id };
      req.adminSession = session;
      next();
    })
    .catch(() => {
      res.status(503).json({ success: false, error: 'No se pudo validar la sesion' });
    });
}

module.exports = {
  authenticateAdmin,
  clearSessionCookie,
  createAdminSession,
  destroyAdminSession,
  requireAdminApi,
  requireAdminPage,
  setSessionCookie,
};
