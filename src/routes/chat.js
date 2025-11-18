const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { verifyFirebaseToken } = require('../middleware/auth')
const { getIO } = require('../chatSocket')

// GET conversations for a user. Includes sender/receiver relations for display names.
router.get('/conversations/:userId', async (req, res) => {
  try {
    const userId = req.params.userId
    const messages = await prisma.message.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      include: { sender: true, receiver: true },
      orderBy: { createdAt: 'desc' }
    })
    res.json(messages)
  } catch (err) {
    console.error('chat conversations error', err)
    res.status(500).json({ error: 'Failed to load conversations' })
  }
})

// POST /api/chat/messages - persist a message and emit over socket.io
router.post('/messages', verifyFirebaseToken, async (req, res) => {
  try {
    const fb = req.firebase
    // derive senderId from internal token or firebase uid
    const senderId = fb && (fb._internal ? fb.sub : fb.uid) || req.body.senderId
    const { receiverId, content } = req.body
    if (!senderId || !receiverId || !content) return res.status(400).json({ error: 'senderId, receiverId and content are required' })

    const m = await prisma.message.create({ data: { senderId, receiverId, content } })
    const full = await prisma.message.findUnique({ where: { id: m.id }, include: { sender: true, receiver: true } })

    // emit via socket if available
    const io = getIO()
    if (io) {
      try {
        io.to(receiverId).emit('message', full)
        io.to(senderId).emit('message', full)
      } catch (e) {
        console.warn('Failed to emit socket message', e?.message || e)
      }
    }

    return res.status(201).json({ message: full })
  } catch (err) {
    console.error('post chat message error', err)
    return res.status(500).json({ error: 'Failed to create message' })
  }
})

module.exports = router
