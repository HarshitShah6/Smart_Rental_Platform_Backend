require('dotenv').config();               // MUST be first
const { initFirebaseAdmin } = require('./firebaseAdmin');
initFirebaseAdmin(); 

const express = require('express')
const http = require('http')
const cors = require('cors')
const { PrismaClient } = require('@prisma/client')
const authRoutes = require('./routes/auth')
const propertyRoutes = require('./routes/properties')
const chatRoutes = require('./routes/chat')
const { initSocket } = require('./chatSocket')

const prisma = new PrismaClient()
const app = express()
const server = http.createServer(app)

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static('uploads'))

app.use('/api/auth', authRoutes)
app.use('/api/properties', propertyRoutes)
app.use('/api/chat', chatRoutes)

app.get('/', (req, res) => res.json({ ok: true }))

initSocket(server)

const PORT = process.env.PORT || 4000
server.listen(PORT, () => console.log(`Backend listening on ${PORT}`))
