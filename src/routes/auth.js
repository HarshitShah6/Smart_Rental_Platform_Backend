const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const { verifyFirebaseToken, signInternalJWT } = require('../middleware/auth')
const prisma = new PrismaClient()

// When client signs in via Firebase, it sends ID token to backend to get internal user record + JWT
router.post('/session', verifyFirebaseToken, async (req, res) => {
  const fb = req.firebase
  try {
    let user = await prisma.user.findUnique({ where: { firebaseId: fb.uid }})
    if (!user) {
      user = await prisma.user.create({
        data: { firebaseId: fb.uid, email: fb.email, name: fb.name || fb.email, role: 'TENANT' }
      })
    }
    const token = signInternalJWT(user)
    res.json({ token, user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
