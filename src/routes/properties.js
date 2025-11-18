// src/routes/properties.js
const express = require('express')
const router = express.Router()
const path = require('path')
const fs = require('fs')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const axios = require('axios')

// Require auth middleware. Prefer the centralized middleware implementation.
let verifyFirebaseToken
try {
  const authMw = require('../middleware/auth')
  verifyFirebaseToken = authMw && authMw.verifyFirebaseToken
  if (!verifyFirebaseToken) {
    // Backwards-compat: some projects might export middleware from a routes-level auth file.
    try {
      const authRoute = require('./auth')
      verifyFirebaseToken = authRoute && authRoute.verifyFirebaseToken
    } catch (e) {
      /* ignore */
    }
  }
  if (!verifyFirebaseToken) {
    console.warn('properties.js: verifyFirebaseToken not found — using noop middleware. Check ../middleware/auth export.')
    verifyFirebaseToken = (req, res, next) => next()
  }
} catch (err) {
  console.warn('properties.js: failed to require ../middleware/auth — using noop verifyFirebaseToken. Error:', err?.message || err)
  verifyFirebaseToken = (req, res, next) => next()
}

// Try to require multer and configure upload. Provide fallback stub if multer missing.
let upload
try {
  const multer = require('multer')
  const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const name = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${path.extname(file.originalname)}`
      cb(null, name)
    }
  })
  upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })
} catch (err) {
  console.warn('properties.js: multer not available or failed to setup. File upload will be disabled. Error:', err?.message || err)
  // fallback middleware: attaches empty files array so code doesn't throw
  upload = {
    array: (fieldName, maxCount) => (req, res, next) => { req.files = []; next() }
  }
}

// Optional: queue helper (enqueuePrediction). Provide a no-op fallback if missing.
let enqueuePrediction
try {
  const q = require('../queues/predictionQueue')
  enqueuePrediction = q && q.enqueuePrediction ? q.enqueuePrediction : async () => {}
  if (!enqueuePrediction) {
    console.warn('properties.js: enqueuePrediction not found in ../queues/predictionQueue — using noop')
    enqueuePrediction = async () => {}
  }
} catch (err) {
  console.warn('properties.js: failed to require ../queues/predictionQueue. Predictions will be skipped. Error:', err?.message || err)
  enqueuePrediction = async () => {}
}

// helper to coerce numbers
const safeNum = v => {
  if (v === undefined || v === null || v === '') return null
  const n = Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

router.post('/', verifyFirebaseToken, upload.array('images', 6), async (req, res) => {
  try {
    // (debug logs removed)
    const body = req.body || {}

    // owner via firebase uid (if verifyFirebaseToken is real it should set req.firebase)
    const firebaseUid = req.firebase?.uid || req.firebase?.sub || body.firebaseId || null

    // =========================
// Owner resolution block
// =========================
let ownerId;
try {
  if (req.firebase && req.firebase.uid) {
    // 1) Prefer linking by Firebase uid
    let user = await prisma.user.findUnique({ where: { firebaseId: req.firebase.uid } });
    if (user) {
      ownerId = user.id
    } else {
      // No user with this firebaseId — try to resolve by email to avoid unique-email conflicts
      const fbEmail = (req.firebase.email || '').toString().trim().toLowerCase()
      if (fbEmail) {
        const existingByEmail = await prisma.user.findUnique({ where: { email: fbEmail } })
        if (existingByEmail) {
          // Link the existing user to this firebase uid if not already linked
          try {
            if (!existingByEmail.firebaseId) {
              const updated = await prisma.user.update({ where: { id: existingByEmail.id }, data: { firebaseId: req.firebase.uid } })
              console.log('Linked existing user to firebase uid:', updated.id)
              ownerId = updated.id
            } else {
              // existing user already has a firebaseId (different) — prefer existing email user
              console.log('Found existing user by email but firebaseId differs; using existing user id:', existingByEmail.id)
              ownerId = existingByEmail.id
            }
          } catch (uerr) {
            console.warn('Failed to link firebaseId to existing user, falling back to using existing user:', uerr?.message || uerr)
            ownerId = existingByEmail.id
          }
        } else {
          // No existing user by email — safe to create
          const created = await prisma.user.create({
            data: {
              firebaseId: req.firebase.uid,
              email: fbEmail || `no-email-${req.firebase.uid}@local`,
              name: req.firebase.name || null,
              role: 'OWNER'
            }
          })
          console.log('Created internal user for firebase uid:', created.id)
          ownerId = created.id
        }
      } else {
        // No email available on token — create user with placeholder email
        const created = await prisma.user.create({
          data: {
            firebaseId: req.firebase.uid,
            email: `no-email-${req.firebase.uid}@local`,
            name: req.firebase.name || null,
            role: 'OWNER'
          }
        })
        console.log('Created internal user (no email) for firebase uid:', created.id)
        ownerId = created.id
      }
    }

  } else if (req.body?.ownerEmail || req.headers['x-owner-email']) {
    // 2) Use email provided by frontend (preferred fallback)
    const ownerEmail = (req.body?.ownerEmail || req.headers['x-owner-email']).toString().trim().toLowerCase();

    // try find user by email first
    let user = await prisma.user.findUnique({ where: { email: ownerEmail } });
    if (!user) {
      // create a new owner using ownerEmail
      user = await prisma.user.create({
        data: {
          firebaseId: `email:${ownerEmail}`, // make a deterministic placeholder firebaseId
          email: ownerEmail,
          name: req.body?.ownerName || null,
          role: 'OWNER'
        }
      });
      console.log('Created owner user for email:', ownerEmail, 'id=', user.id);
    }
    ownerId = user.id;

  } else {
    // 3) No token and no email: create a safe throwaway owner (local/dev)
    const anonEmail = `owner+anon+${Date.now()}@local`;
    let user = await prisma.user.create({
      data: {
        firebaseId: `anon:${Date.now()}`,
        email: anonEmail,
        name: 'Anonymous Owner',
        role: 'OWNER'
      }
    });
    ownerId = user.id;
    console.warn('No firebase token nor ownerEmail: created anonymous owner', ownerId);
  }
} catch (err) {
  console.error('Error resolving/creating owner:', err);
  return res.status(500).json({ error: 'Failed to resolve owner' });
}



    // let ownerId = null
    // if (firebaseUid) {
    //   const owner = await prisma.user.findUnique({ where: { firebaseId: firebaseUid } })
    //   if (!owner) {
    //     // If user doesn't exist, optionally auto-create or return error. We return 400 for clarity.
    //     return res.status(400).json({ error: 'User not found in DB (firebaseId missing). Ensure you create a User with matching firebaseId.' })
    //   }
    //   ownerId = owner.id
    // } else {
    //   return res.status(401).json({ error: 'Unauthorized: firebase uid not provided' })
    // }

    // Minimal required fields validation
    if (!body.title || !body.address) {
      return res.status(400).json({ error: 'title and address required' })
    }

    // price handling
    const priceINR = safeNum(body.priceINR) ?? safeNum(body.price) ?? (safeNum(body.priceUSD) ? (process.env.EXCHANGE_RATE_USD_TO_INR ? safeNum(body.priceUSD) * Number(process.env.EXCHANGE_RATE_USD_TO_INR) : safeNum(body.priceUSD)) : 0)

    // Collect model fields (exclude ListingID, Locality, area and geo fields for ML)
    const features = {
      City: body.City || body.city || null,
      PropertyType: body.PropertyType || body.propertyType || null,
      BHK: safeNum(body.BHK) ?? safeNum(body.bhk) ?? safeNum(body.bedrooms) ?? null,
      Bathrooms: safeNum(body.Bathrooms) ?? safeNum(body.bathrooms) ?? null,
      Balconies: safeNum(body.Balconies) ?? safeNum(body.balconies) ?? null,
      Furnishing: body.Furnishing ?? body.furnishing ?? null,
      CarpetArea_sqft: safeNum(body.CarpetArea_sqft) ?? safeNum(body.carpetAreaSqft) ?? null,
      Floor: safeNum(body.Floor) ?? safeNum(body.floor) ?? null,
      TotalFloors: safeNum(body.TotalFloors) ?? safeNum(body.totalFloors) ?? null,
      Parking: body.Parking ?? body.parking ?? null,
      BuildingType: body.BuildingType ?? body.buildingType ?? null,
      YearBuilt: safeNum(body.YearBuilt) ?? safeNum(body.yearBuilt) ?? null,
      AgeYears: safeNum(body.AgeYears) ?? safeNum(body.ageYears) ?? null,
      Facing: body.Facing ?? body.facing ?? null,
      AmenitiesCount: safeNum(body.AmenitiesCount) ?? safeNum(body.amenitiesCount) ?? null,
      IsRERARegistered: (body.IsRERARegistered === 'true' || body.IsRERARegistered === true || body.isReraRegistered === 'true' || body.isReraRegistered === true) ?? false,
      RERAID: body.RERAID ?? body.reraId ?? null,
      Price_INR: priceINR
    }

    // Prepare prisma data (ensure prisma schema supports these fields)
    const pData = {
      ownerId,
      title: body.title,
      description: body.description ?? '',
      price: priceINR ?? 0,
      predictedRent: null,
      fraudScore: null,
      address: body.address,
      city: features.City ?? null,
      country: body.country ?? null,
      features,
      bhk: features.BHK,
      bathrooms: features.Bathrooms,
      balconies: features.Balconies,
      // Keep area/geo stored in DB (derived from body) but do not send to ML
      superBuiltUpAreaSqft: safeNum(body.SuperBuiltUpArea_sqft) ?? safeNum(body.superBuiltUpAreaSqft) ?? null,
      builtUpAreaSqft: safeNum(body.BuiltUpArea_sqft) ?? safeNum(body.builtUpAreaSqft) ?? (safeNum(body.SuperBuiltUpArea_sqft) ? Math.round(safeNum(body.SuperBuiltUpArea_sqft) * 0.95) : null),
      carpetAreaSqft: safeNum(body.CarpetArea_sqft) ?? safeNum(body.carpetAreaSqft) ?? (safeNum(body.BuiltUpArea_sqft) ? Math.round(safeNum(body.BuiltUpArea_sqft) * 0.85) : null),
      floor: features.Floor,
      totalFloors: features.TotalFloors,
      parking: features.Parking,
      propertyType: features.PropertyType,
      buildingType: features.BuildingType,
      yearBuilt: features.YearBuilt,
      ageYears: features.AgeYears,
      facing: features.Facing,
      amenitiesCount: features.AmenitiesCount,
      isReraRegistered: features.IsRERARegistered,
      reraId: features.RERAID,
      latitude: safeNum(body.Latitude) ?? safeNum(body.latitude) ?? null,
      longitude: safeNum(body.Longitude) ?? safeNum(body.longitude) ?? null
    }

    const created = await prisma.property.create({ data: pData })

    try {
  await prisma.user.update({
    where: { id: ownerId },
    data: { listingCount: { increment: 1 } }
  });
} catch (err) {
  console.warn('Failed to increment listingCount for owner', ownerId, err);
  // not fatal for property creation
}


    // store images saved by multer (if any)
    const files = req.files || []
    if (files.length) {
      const base = `${req.protocol}://${req.get('host')}/uploads`
      const imgs = files.map(f => ({ propertyId: created.id, url: `${base}/${f.filename}` }))
      await prisma.propertyImage.createMany({ data: imgs, skipDuplicates: true })
    }

    // enqueue prediction
    try {
      await enqueuePrediction({
        propertyId: created.id,
        features
      })
    } catch (e) {
      console.warn('enqueuePrediction error:', e?.message || e)
    }

    return res.status(201).json({ property: created })
  } catch (err) {
    console.error('create property error', err)
    return res.status(500).json({ error: 'Failed to create property', detail: err?.message || String(err) })
  }
})

module.exports = router

// GET /api/properties/search - simple search with filters
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : null
    const city = req.query.city ? String(req.query.city).trim() : null
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null
    const limit = req.query.limit ? Math.min(100, Number(req.query.limit)) : 20
    const ownerId = req.query.ownerId ? String(req.query.ownerId).trim() : null

    const where = { AND: [] }
    if (q) {
      where.AND.push({ OR: [ { title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } } ] })
    }
    if (city) {
      where.AND.push({ city: { contains: city, mode: 'insensitive' } })
    }
    if (minPrice !== null && !Number.isNaN(minPrice)) {
      where.AND.push({ price: { gte: minPrice } })
    }
    if (maxPrice !== null && !Number.isNaN(maxPrice)) {
      where.AND.push({ price: { lte: maxPrice } })
    }

    if (ownerId) {
      // allow filtering properties by owner id (used by owner dashboard)
      where.AND.push({ ownerId })
    }

    // If no filters, remove empty AND to fetch all
    const finalWhere = (where.AND.length > 0) ? where : {}

    let properties = await prisma.property.findMany({
      where: finalWhere,
      include: { images: true },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    // If predictions are not yet computed, provide a harmless fallback so clients
    // can display a prediction (fallback to stored price). Also expose a
    // `predictedIsFallback` flag so UI can distinguish real predictions from
    // fallbacks and avoid misleading displays where both numbers match.
    properties = properties.map(p => {
      const isFallback = (p.predictedRent === null || p.predictedRent === undefined)
      return { ...p, predictedRent: isFallback ? p.price : p.predictedRent, predictedIsFallback: isFallback }
    })

    return res.json(properties)
  } catch (err) {
    console.error('search properties error', err)
    return res.status(500).json({ error: 'Failed to search properties' })
  }
})

// GET /api/properties/:id - fetch property details
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id
    const property = await prisma.property.findUnique({
      where: { id },
      include: { images: true }
    })
    if (!property) return res.status(404).json({ error: 'Property not found' })

    // Provide a fallback predictedRent when the prediction hasn't been written
    // to the DB yet (worker not running / ML service unreachable). Also set
    // `predictedIsFallback` so clients can avoid treating the fallback as a
    // genuine model prediction.
    const isFallback = (property.predictedRent === null || property.predictedRent === undefined)
    if (isFallback) {
      property.predictedRent = property.price
    }
    property.predictedIsFallback = isFallback

    return res.json({ property })
  } catch (err) {
    console.error('get property error', err)
    return res.status(500).json({ error: 'Failed to fetch property' })
  }
})

// POST /api/properties/:id/predict-now - trigger an immediate prediction for debugging/admin
router.post('/:id/predict-now', async (req, res) => {
  try {
    const id = req.params.id
    const property = await prisma.property.findUnique({ where: { id } })
    if (!property) return res.status(404).json({ error: 'Property not found' })

    // Build features similar to the worker / create flow
    const features = {
      City: property.city || null,
      PropertyType: property.propertyType || null,
      BHK: property.bhk ?? null,
      Bathrooms: property.bathrooms ?? null,
      Balconies: property.balconies ?? null,
      Furnishing: property.features?.Furnishing ?? property.furnishing ?? null,
      CarpetArea_sqft: property.carpetAreaSqft ?? null,
      Floor: property.floor ?? null,
      TotalFloors: property.totalFloors ?? null,
      Parking: property.parking ?? null,
      BuildingType: property.buildingType ?? null,
      YearBuilt: property.yearBuilt ?? null,
      AgeYears: property.ageYears ?? null,
      Facing: property.facing ?? null,
      AmenitiesCount: property.amenitiesCount ?? null,
      IsRERARegistered: property.isReraRegistered ?? false,
      RERAID: property.reraId ?? null,
      // Price optionally included
      Price_INR: property.price ?? null
    }

    const ML_BASE = process.env.ML_BASE || 'http://localhost:8000'
    let resp
    try {
      resp = await axios.post(`${ML_BASE}/predict`, features, { timeout: 20000 })
    } catch (e) {
      console.error('predict-now: ML service error', e?.response?.data || e?.message || e)
      return res.status(502).json({ error: 'ML service call failed', detail: e?.message || e })
    }

    const predicted_price = resp?.data?.predicted_price ?? resp?.data?.predicted_price_inr ?? null
    if (predicted_price === null || predicted_price === undefined) {
      return res.status(500).json({ error: 'ML service returned no prediction', detail: resp?.data })
    }

    const updated = await prisma.property.update({ where: { id }, data: { predictedRent: Number(predicted_price) } })
    return res.json({ ok: true, predicted: Number(predicted_price), property: updated })
  } catch (err) {
    console.error('predict-now error', err)
    return res.status(500).json({ error: 'Failed to run prediction', detail: err?.message || String(err) })
  }
})

// PUT /api/properties/:id - update property (ownership enforced)
router.put('/:id', verifyFirebaseToken, async (req, res) => {
  try {
    const id = req.params.id

    // Resolve acting user (similar to set-role)
    let actingUser = null
    if (req.firebase && req.firebase._internal) {
      const userId = req.firebase.sub || req.firebase.uid
      actingUser = await prisma.user.findUnique({ where: { id: userId } })
    } else if (req.firebase && req.firebase.uid) {
      actingUser = await prisma.user.findUnique({ where: { firebaseId: req.firebase.uid } })
      if (!actingUser && req.firebase.email) actingUser = await prisma.user.findUnique({ where: { email: req.firebase.email } })
    }
    if (!actingUser) return res.status(401).json({ error: 'Unauthorized: user not found' })

    const property = await prisma.property.findUnique({ where: { id } })
    if (!property) return res.status(404).json({ error: 'Property not found' })

    // Allow only owner or admin
    if (property.ownerId !== actingUser.id && actingUser.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: you are not the owner of this property' })
    }

    const body = req.body || {}
    // Validation
    if (body.title !== undefined && String(body.title).trim().length === 0) {
      return res.status(400).json({ error: 'title must not be empty' })
    }
    if (body.price !== undefined && Number.isNaN(Number(body.price))) {
      return res.status(400).json({ error: 'price must be a numeric value' })
    }

    const updates = {}
    if (body.title !== undefined) updates.title = String(body.title)
    if (body.description !== undefined) updates.description = String(body.description)
    if (body.address !== undefined) updates.address = String(body.address)
    if (body.city !== undefined) updates.city = String(body.city)
    if (body.price !== undefined) updates.price = Number(body.price)
    if (body.isRented !== undefined) updates.isRented = (body.isRented === true || body.isRented === 'true')
    if (body.features !== undefined) updates.features = body.features

    // Attempt update; handle older Prisma schemas that may not have `isRented` field
    try {
      const updated = await prisma.property.update({ where: { id }, data: updates })
      return res.json({ property: updated })
    } catch (err) {
      // If the schema doesn't contain `isRented`, Prisma throws a validation error mentioning Unknown argument `isRented`.
      const msg = (err && err.message) ? String(err.message) : ''
      if (msg.includes("Unknown argument `isRented`") || msg.includes('Unknown argument `is_rented`')) {
        // remove unsupported field and retry
        try {
          delete updates.isRented
          const updated = await prisma.property.update({ where: { id }, data: updates })
          return res.json({ property: updated })
        } catch (err2) {
          console.error('update property retry error after removing isRented', err2)
          return res.status(500).json({ error: 'Failed to update property after schema adjustment', detail: err2?.message || String(err2) })
        }
      }

      console.error('update property error', err)
      return res.status(500).json({ error: 'Failed to update property', detail: err?.message || String(err) })
    }
  } catch (err) {
    console.error('update property error', err)
    return res.status(500).json({ error: 'Failed to update property' })
  }
})

// DELETE /api/properties/:id - delete property (ownership enforced)
router.delete('/:id', verifyFirebaseToken, async (req, res) => {
  try {
    const id = req.params.id
    // (debug logs removed)

    // Resolve acting user
    let actingUser = null
    if (req.firebase && req.firebase._internal) {
      const userId = req.firebase.sub || req.firebase.uid
      actingUser = await prisma.user.findUnique({ where: { id: userId } })
    } else if (req.firebase && req.firebase.uid) {
      actingUser = await prisma.user.findUnique({ where: { firebaseId: req.firebase.uid } })
      if (!actingUser && req.firebase.email) actingUser = await prisma.user.findUnique({ where: { email: req.firebase.email } })
    }
    if (!actingUser) return res.status(401).json({ error: 'Unauthorized: user not found' })

    const property = await prisma.property.findUnique({ where: { id } })
    if (!property) return res.status(404).json({ error: 'Property not found' })

    // Allow only owner or admin
    if (property.ownerId !== actingUser.id && actingUser.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: you are not the owner of this property' })
    }

    // Delete image files from disk and image records
    try {
      const imgs = await prisma.propertyImage.findMany({ where: { propertyId: id } })
      for (const im of imgs) {
        try {
          const url = im.url || ''
          let filename = ''
          try {
            const parsed = new URL(url)
            filename = path.basename(parsed.pathname)
          } catch (e) {
            filename = path.basename(url)
          }
          if (filename) {
            const filePath = path.join(process.cwd(), 'uploads', filename)
            if (fs.existsSync(filePath)) {
              try { fs.unlinkSync(filePath) } catch (e) { console.warn('Failed to unlink file', filePath, e?.message || e) }
            }
          }
        } catch (e) {
          console.warn('Failed to remove image file for property', id, e?.message || e)
        }
      }

      await prisma.propertyImage.deleteMany({ where: { propertyId: id } })
    } catch (e) {
      console.warn('Failed to delete property images records or files', e?.message || e)
    }

    // Delete property
    await prisma.property.delete({ where: { id } })

    // Decrement owner's listingCount if possible
    try {
      await prisma.user.update({ where: { id: property.ownerId }, data: { listingCount: { decrement: 1 } } })
    } catch (e) {
      console.warn('Failed to decrement listingCount for owner', property.ownerId, e?.message || e)
    }

    return res.json({ ok: true })
  } catch (err) {
    console.error('delete property error', err)
    return res.status(500).json({ error: 'Failed to delete property' })
  }
})

// POST /api/properties/:id/photos - upload photos for existing property (ownership enforced)
router.post('/:id/photos', verifyFirebaseToken, upload.array('images', 6), async (req, res) => {
  try {
    const id = req.params.id

    // Resolve acting user
    let actingUser = null
    if (req.firebase && req.firebase._internal) {
      const userId = req.firebase.sub || req.firebase.uid
      actingUser = await prisma.user.findUnique({ where: { id: userId } })
    } else if (req.firebase && req.firebase.uid) {
      actingUser = await prisma.user.findUnique({ where: { firebaseId: req.firebase.uid } })
      if (!actingUser && req.firebase.email) actingUser = await prisma.user.findUnique({ where: { email: req.firebase.email } })
    }
    if (!actingUser) return res.status(401).json({ error: 'Unauthorized: user not found' })

    const property = await prisma.property.findUnique({ where: { id } })
    if (!property) return res.status(404).json({ error: 'Property not found' })

    // Only owner or admin may upload photos
    if (property.ownerId !== actingUser.id && actingUser.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: you are not the owner of this property' })
    }

    const files = req.files || []
    if (!files.length) return res.status(400).json({ error: 'No files uploaded' })

    const base = `${req.protocol}://${req.get('host')}/uploads`
    const imgs = files.map(f => ({ propertyId: id, url: `${base}/${f.filename}` }))
    await prisma.propertyImage.createMany({ data: imgs, skipDuplicates: true })

    return res.status(201).json({ uploaded: imgs })
  } catch (err) {
    console.error('upload photos error', err)
    return res.status(500).json({ error: 'Failed to upload photos' })
  }
})
