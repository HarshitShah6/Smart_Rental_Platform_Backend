// src/routes/uploads.js
const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')

const router = express.Router()
const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

// ensure uploads dir
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${path.extname(file.originalname)}`
    cb(null, name)
  }
})

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }) // 10MB

// POST /uploads — accepts field 'file' or 'images' (single/multiple)
router.post('/', upload.array('images', 6), (req, res) => {
  try {
    const files = req.files || []
    // Build accessible URLs — server exposes /uploads via express.static in index.js
    const base = `${req.protocol}://${req.get('host')}/uploads`
    const urls = files.map(f => `${base}/${f.filename}`)
    res.json({ success: true, urls, files: files.map(f => f.filename) })
  } catch (err) {
    console.error('upload error', err)
    res.status(500).json({ error: 'Upload failed' })
  }
})

module.exports = router
