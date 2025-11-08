const { Server } = require('socket.io')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function initSocket(server) {
  const io = new Server(server, { cors: { origin: '*' }})
  io.on('connection', socket => {
    socket.on('join', ({ userId }) => socket.join(userId))
    socket.on('message', async (msg) => {
      // msg = { senderId, receiverId, content }
      try {
        const m = await prisma.message.create({ data: { ...msg } })
        io.to(msg.receiverId).emit('message', m)
      } catch (err) {
        console.error('socket message error', err)
      }
    })
  })
}

module.exports = { initSocket }
