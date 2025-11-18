// services/backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { initFirebaseAdmin, getAdmin } = require('../firebaseAdmin');

// Ensure we attempt initialization (no-op if already done)
initFirebaseAdmin();

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

async function verifyFirebaseToken(req, res, next) {
  const admin = getAdmin();
  if (!admin) {
    // Fail loudly so the developer knows the server isn't configured
    return res.status(503).json({ error: 'Firebase admin not configured. Set FIREBASE_ADMIN_SDK or FIREBASE_ADMIN_SDK_PATH.' });
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });

  // Heuristic: inspect the JWT header to decide whether it looks like a Firebase ID token.
  // Firebase ID tokens are signed by Google and include a `kid` header (key id).
  const looksLikeFirebaseToken = (() => {
    try {
      const parts = token.split('.')
      if (parts.length < 2) return false
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf8'))
      return typeof header.kid !== 'undefined'
    } catch (e) {
      return false
    }
  })()

  if (looksLikeFirebaseToken && admin) {
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      req.firebase = decoded;
      return next();
    } catch (err) {
      // Most common: token wasn't actually a Firebase token (no kid) or verification failed.
      // Log at warn level and fall back to internal JWT verification.
      console.warn('verifyIdToken failed:', err && err.message ? err.message : err);
    }
  }

  // If Firebase verification failed or admin not configured, try internal JWT
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // Map internal token payload to a minimal firebase-like object used elsewhere
    req.firebase = {
      uid: payload.sub,
      email: payload.email,
      role: payload.role,
      _internal: true
    };
    return next();
  } catch (err) {
    console.error('verifyInternalJWT failed:', err && err.message ? err.message : err);
    return res.status(401).json({ error: 'Invalid token', detail: err?.message });
  }
}

function signInternalJWT(user) {
  const payload = { sub: user.id, role: user.role, email: user.email };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

module.exports = { verifyFirebaseToken, signInternalJWT };
