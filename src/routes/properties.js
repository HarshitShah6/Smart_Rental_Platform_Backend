const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { verifyFirebaseToken } = require('../middleware/auth')
const { PrismaClient } = require('@prisma/client')
const { checkFraudAndPredictRent } = require('../utils/mlClient')
const prisma = new PrismaClient()

// ensure uploads folder exists
const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
})

const upload = multer({ storage })

// create listing
router.post('/', verifyFirebaseToken, upload.array('images', 6), async (req, res) => {
  const fb = req.firebase
  const { title, description, price, address, city, country, features } = req.body
  try {
    const user = await prisma.user.findUnique({ where: { firebaseId: fb.uid }})
    if (!user) return res.status(404).json({ error: 'User not found' })

    const property = await prisma.property.create({
      data: {
        ownerId: user.id,
        title,
        description,
        price: parseFloat(price),
        address, city, country,
        features: features ? JSON.parse(features) : {}
      }
    })

    const imagePromises = (req.files || []).map(f => prisma.propertyImage.create({
      data: { propertyId: property.id, url: `/uploads/${f.filename}` }
    }))
    await Promise.all(imagePromises)

    // call ML microservice
    const mlRes = await checkFraudAndPredictRent({...property, description})
    await prisma.property.update({ where: { id: property.id }, data: { fraudScore: mlRes.fraudScore, predictedRent: mlRes.predictedRent } })

    res.json({ propertyId: property.id, predictedRent: mlRes.predictedRent, fraudScore: mlRes.fraudScore })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// search endpoint
router.get('/search', async (req, res) => {
  const { city, minPrice, maxPrice, q } = req.query
  const where = {}
  if (city) where.city = { equals: city }
  if (minPrice || maxPrice) {
    where.price = {}
    if (minPrice) where.price.gte = Number(minPrice)
    if (maxPrice) where.price.lte = Number(maxPrice)
  }
  if (q) {
    where.OR = [{ title: { contains: q }}, { description: { contains: q }}]
  }
  const props = await prisma.property.findMany({ where, include: { images: true } })
  res.json(props)
})

module.exports = router
