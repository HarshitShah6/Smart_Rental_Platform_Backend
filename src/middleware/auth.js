const admin = require('firebase-admin')
const jwt = require('jsonwebtoken')

// initialize firebase admin with JSON string in env
if (!admin.apps.length) {
  try {
    const sdk = process.env.FIREBASE_ADMIN_SDK ? JSON.parse(process.env.FIREBASE_ADMIN_SDK) : null
    if (sdk) {
      admin.initializeApp({ credential: admin.credential.cert(sdk) })
    }
  } catch (err) {
    console.warn('Firebase admin init failed (FIREBASE_ADMIN_SDK likely not set)')
  }
}

const verifyFirebaseToken = async (req, res, next) => {
  const auth = req.headers.authorization || ''
  const token = auth.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No token' })
  try {
    if (!admin.apps.length) throw new Error('Firebase admin not initialized')
    const decoded = await admin.auth().verifyIdToken(token)
    req.firebase = decoded
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token', detail: err?.message })
  }
}

// Internal short JWT for role-based checks
const signInternalJWT = (user) => {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '1h' })
}

module.exports = { verifyFirebaseToken, signInternalJWT }
