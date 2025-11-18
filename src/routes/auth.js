const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const { verifyFirebaseToken, signInternalJWT } = require('../middleware/auth')
const prisma = new PrismaClient()

// When client signs in via Firebase, it sends ID token to backend to get internal user record + JWT
router.post('/session', verifyFirebaseToken, async (req, res) => {
  const fb = req.firebase
  try {
    // First try to find by firebaseId
    let user = null
    if (fb && fb.uid) {
      user = await prisma.user.findUnique({ where: { firebaseId: fb.uid }})
    }

    // If not found by firebaseId, try to find by email and link accounts
    if (!user && fb && fb.email) {
      user = await prisma.user.findUnique({ where: { email: fb.email }})
      if (user) {
        // Link firebaseId to existing user (avoid unique email constraint)
        try {
          user = await prisma.user.update({ where: { id: user.id }, data: { firebaseId: fb.uid } })
        } catch (e) {
          console.warn('Failed to link firebaseId to existing user:', e?.message || e)
        }
      }
    }

    // If still not found, create a new user
    if (!user) {
      user = await prisma.user.create({
        data: { firebaseId: fb.uid || `firebase:${Date.now()}`, email: fb.email || `no-email-${Date.now()}@local`, name: fb.name || fb.email || null, role: 'TENANT' }
      })
    }
    const token = signInternalJWT(user)
    res.json({ token, user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/auth/set-role - allow a logged-in user to set their own role (TENANT or OWNER)
router.post('/set-role', verifyFirebaseToken, async (req, res) => {
  try {
    const requestedRole = (req.body && req.body.role) ? String(req.body.role).toUpperCase() : null
    if (!requestedRole || !['TENANT', 'OWNER'].includes(requestedRole)) {
      return res.status(400).json({ error: 'Invalid role. Allowed values: TENANT, OWNER' })
    }

    // Resolve the internal user id from the token
    let user = null
    if (req.firebase && req.firebase._internal) {
      // internal JWT: sub contains internal user id
      const userId = req.firebase.sub
      user = await prisma.user.findUnique({ where: { id: userId } })
    } else if (req.firebase && req.firebase.uid) {
      // Firebase ID token: find by firebaseId
      user = await prisma.user.findUnique({ where: { firebaseId: req.firebase.uid } })
      // fallback: try by email
      if (!user && req.firebase.email) {
        user = await prisma.user.findUnique({ where: { email: req.firebase.email } })
      }
    }

    if (!user) return res.status(404).json({ error: 'User not found' })

    // Update role
    const updated = await prisma.user.update({ where: { id: user.id }, data: { role: requestedRole } })
    return res.json({ user: updated })
  } catch (err) {
    console.error('set-role error', err)
    return res.status(500).json({ error: 'Failed to set role' })
  }
})

module.exports = router
