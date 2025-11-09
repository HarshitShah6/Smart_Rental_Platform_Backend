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

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.firebase = decoded;
    return next();
  } catch (err) {
    console.error('verifyIdToken failed:', err && err.message ? err.message : err);
    return res.status(401).json({ error: 'Invalid Firebase ID token', detail: err?.message });
  }
}

function signInternalJWT(user) {
  const payload = { sub: user.id, role: user.role, email: user.email };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

module.exports = { verifyFirebaseToken, signInternalJWT };
