// src/index.js
require('dotenv').config()
const express = require('express')
const http = require('http')
const cors = require('cors')
const path = require('path')

// route imports (only after app created below)
const authRoutes = require('./routes/auth')        // if this exports a router
const propertyRoutes = require('./routes/properties')
const chatRoutes = require('./routes/chat')
const uploadsRoutes = require('./routes/uploads')  // optional if you created it
const { initSocket } = require('./chatSocket')    // ensure chatSocket doesn't require index.js

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// create app before using it
const app = express()
const server = http.createServer(app)

app.use(cors())
app.use(express.json())
// serve uploads (static) AFTER app is created
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

// Mount API routes AFTER creating app
app.use('/api/auth', authRoutes)
app.use('/api/properties', propertyRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/uploads', uploadsRoutes) // optional

app.get('/', (req, res) => res.json({ ok: true }))

// initialize socket only after server created; ensure initSocket does not import index.js
try {
  if (typeof initSocket === 'function') initSocket(server)
} catch (err) {
  console.warn('initSocket error', err?.message || err)
}

const PORT = process.env.PORT || 4000
server.listen(PORT, () => console.log(`Backend listening on ${PORT}`))

// existing code...
initSocket(server)

// start prediction worker optionally
if (process.env.START_PREDICT_WORKER === 'true') {
  try {
    const { startPredictWorker } = require('./workers/predictWorker')
    startPredictWorker()
  } catch (e) {
    console.warn('Failed to start predict worker in same process:', e?.message)
  }
}


// after initSocket(server) or near the bottom of index.js
const { startPredictWorker } = require('./workers/predictWorker')
if (process.env.START_PREDICT_WORKER === 'true') {
  startPredictWorker()
}