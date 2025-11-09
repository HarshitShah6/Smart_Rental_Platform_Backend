// services/backend/src/firebaseAdmin.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');

let admin = null;
let initialized = false;

function normalizePrivateKey(parsed) {
  if (!parsed || !parsed.private_key) return parsed;

  // Convert literal backslash-n sequences to real newlines
  if (parsed.private_key.includes('\\n')) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    console.log('firebaseAdmin: normalized private_key (converted \\n -> newline).');
  }

  // Trim whitespace
  parsed.private_key = parsed.private_key.trim();

  // Ensure header/footer are present and footer ends with newline
  const begin = '-----BEGIN PRIVATE KEY-----';
  const end = '-----END PRIVATE KEY-----';
  if (!parsed.private_key.startsWith(begin)) {
    // attempt to recover by finding begin
    const idx = parsed.private_key.indexOf(begin);
    if (idx >= 0) parsed.private_key = parsed.private_key.slice(idx);
  }
  if (!parsed.private_key.includes(end)) {
    // If footer missing, append it (best effort)
    console.warn('firebaseAdmin: PRIVATE KEY footer missing — appending footer line (best-effort).');
    // Attempt to remove any trailing junk after last base64 chunk and append footer
    // Keep the key as-is then append footer and newline
    parsed.private_key = parsed.private_key + '\n' + end + '\n';
  } else {
    // Ensure it ends with a newline after the footer
    if (!parsed.private_key.trim().endsWith(end)) {
      parsed.private_key = parsed.private_key.trim();
      if (!parsed.private_key.endsWith('\n')) parsed.private_key = parsed.private_key + '\n';
    } else if (!parsed.private_key.endsWith('\n')) {
      parsed.private_key = parsed.private_key + '\n';
    }
  }

  return parsed;
}

function initFirebaseAdmin() {
  if (initialized) {
    console.log('⚪ Firebase admin already initialized.');
    return admin;
  }

  try {
    const raw = process.env.FIREBASE_ADMIN_SDK;
    let parsed = null;
    if (raw) {
      parsed = JSON.parse(raw);
      parsed = normalizePrivateKey(parsed);
      console.log('firebaseAdmin: using FIREBASE_ADMIN_SDK env var (length=' + String(raw.length) + ')');
    } else if (process.env.FIREBASE_ADMIN_SDK_PATH) {
      const p = path.isAbsolute(process.env.FIREBASE_ADMIN_SDK_PATH)
        ? process.env.FIREBASE_ADMIN_SDK_PATH
        : path.join(process.cwd(), process.env.FIREBASE_ADMIN_SDK_PATH);
      if (fs.existsSync(p)) {
        parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
        parsed = normalizePrivateKey(parsed);
        console.log('firebaseAdmin: using FIREBASE_ADMIN_SDK_PATH file:', p);
      } else {
        console.error('firebaseAdmin: FIREBASE_ADMIN_SDK_PATH file not found:', p);
      }
    } else {
      console.warn('firebaseAdmin: no credentials found in FIREBASE_ADMIN_SDK or FIREBASE_ADMIN_SDK_PATH');
    }

    if (!parsed) {
      initialized = false;
      return null;
    }

    const firebaseAdmin = require('firebase-admin');
    if (!firebaseAdmin.apps.length) {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(parsed),
      });
      console.log('✅ Firebase admin initialized with service account.');
    } else {
      console.log('⚪ firebase-admin already had an initialized app; skipping initializeApp()');
    }
    admin = firebaseAdmin;
    initialized = true;
    return admin;
  } catch (err) {
    console.error('❌ Firebase admin init error:', err && err.message ? err.message : err);
    initialized = false;
    return null;
  }
}

module.exports = { initFirebaseAdmin, getAdmin: () => admin, initialized: () => initialized };
