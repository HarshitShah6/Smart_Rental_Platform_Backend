const { Server } = require('socket.io')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

let ioInstance = null

function initSocket(server) {
  if (ioInstance) return ioInstance
  const io = new Server(server, { cors: { origin: '*' }})
  io.on('connection', socket => {
    socket.on('join', ({ userId }) => socket.join(userId))
    socket.on('message', async (msg) => {
      // msg = { senderId, receiverId, content }
      try {
        const m = await prisma.message.create({ data: { ...msg } })
        // include sender/receiver relations for convenience
        const full = await prisma.message.findUnique({ where: { id: m.id }, include: { sender: true, receiver: true } })
        io.to(msg.receiverId).emit('message', full)
        io.to(msg.senderId).emit('message', full)
      } catch (err) {
        console.error('socket message error', err)
      }
    })
  })
  ioInstance = io
  return ioInstance
}

function getIO() {
  return ioInstance
}

module.exports = { initSocket, getIO }
