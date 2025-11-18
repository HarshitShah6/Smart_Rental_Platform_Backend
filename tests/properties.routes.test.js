// tests/properties.routes.test.js

// ---------------------------
// Top-of-file mocks (paste exactly)
// ---------------------------

// ioredis mock (ensure ioredis-mock is installed)
jest.mock('ioredis', () => require('ioredis-mock'));

// bullmq lightweight mocks
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ add: jest.fn(), close: jest.fn() })),
  Worker: jest.fn().mockImplementation(() => ({ close: jest.fn() })),
  QueueScheduler: jest.fn().mockImplementation(() => ({ close: jest.fn() })),
}));

// predictionQueue: avoid requiring a queue that needs redis
jest.mock('../src/queues/predictionQueue', () => ({ enqueuePrediction: async () => {} }));

// AUTH: mock the real module paths that properties.js will try to require.
//  - src/middleware/auth  (../middleware/auth from inside src/routes)
//  - src/routes/auth      (./auth from inside src/routes)
jest.mock('../src/middleware/auth', () => ({
  initFirebaseAdmin: jest.fn(),
  verifyFirebaseToken: (req, res, next) => {
    const sub = req.headers['x-test-sub'] || 'owner-1';
    const role = req.headers['x-test-role'] || 'OWNER';
    req.firebase = { uid: sub, role };
    next();
  },
}));
jest.mock('../src/routes/auth', () => ({
  verifyFirebaseToken: (req, res, next) => {
    const sub = req.headers['x-test-sub'] || 'owner-1';
    const role = req.headers['x-test-role'] || 'OWNER';
    req.firebase = { uid: sub, role };
    next();
  },
}));

// Now prisma and fs mocks (these can stay)
jest.mock('@prisma/client', () => {
  const mock = {
    property: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    propertyImage: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    }
  }
  return { PrismaClient: jest.fn(() => mock) }
})

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  unlinkSync: jest.fn(),
}))

// Now safe to require test libraries and modules
const request = require('supertest')
const express = require('express')



describe('Properties routes - ownership and deletion', () => {
  let app
  let prisma
  let propertiesRouter

  beforeEach(() => {
    // Reset module registry so requiring modules returns fresh copies
    jest.resetModules()

    // require the mocked prisma instance fresh
    const client = require('@prisma/client')
    const PrismaClient = client.PrismaClient
    prisma = new PrismaClient()

    // DEFAULT behavior for prisma.user.findUnique used by many tests.
    // inside beforeEach, after `prisma = new PrismaClient()`
// robust default for prisma.user.findUnique: finds owner/admin in any where shape
prisma.user.findUnique.mockImplementation(({ where } = {}) => {
  if (!where) return Promise.resolve(null)

  // recursively search an object/array for string values matching our test ids
  const containsTestUser = (obj) => {
    if (obj == null) return false
    if (typeof obj === 'string') {
      return obj === 'owner-1' || obj === 'admin-1'
    }
    if (Array.isArray(obj)) {
      return obj.some(containsTestUser)
    }
    if (typeof obj === 'object') {
      return Object.values(obj).some(containsTestUser)
    }
    return false
  }

  if (containsTestUser(where)) {
    // if owner-1 present anywhere
    if (containsTestUser(where) && JSON.stringify(where).includes('owner-1')) {
      return Promise.resolve({ id: 'owner-1', role: 'OWNER' })
    }
    if (containsTestUser(where) && JSON.stringify(where).includes('admin-1')) {
      return Promise.resolve({ id: 'admin-1', role: 'ADMIN' })
    }
  }

  return Promise.resolve(null)
})


    // require the router AFTER the above mocks and PrismaClient creation so the router
    // uses the same mocked PrismaClient instance in this test run.
    propertiesRouter = require('../src/routes/properties')

    // create express app using the freshly required router
    app = express()
    app.use(express.json())
    app.use('/api/properties', propertiesRouter)
  })

  afterEach(() => {
    // optional cleanup
    jest.clearAllMocks()
  })

  test('DELETE /api/properties/:id - success when owner', async () => {
    // setup mocks
    prisma.property.findUnique.mockResolvedValue({ id: 'prop-1', ownerId: 'owner-1' })
    prisma.propertyImage.findMany.mockResolvedValue([{ id: 'img-1', url: 'http://localhost:4000/uploads/test.jpg' }])
    prisma.propertyImage.deleteMany.mockResolvedValue({ count: 1 })
    prisma.property.delete.mockResolvedValue({ id: 'prop-1' })
    prisma.user.update.mockResolvedValue({ id: 'owner-1', listingCount: 0 })

    const res = await request(app)
      .delete('/api/properties/prop-1')
      .set('Authorization', 'Bearer faketoken')
      .set('x-test-sub', 'owner-1')
      .set('x-test-role', 'OWNER')
      .expect(200)

    expect(res.body.ok).toBe(true)
    expect(prisma.property.delete).toHaveBeenCalledWith({ where: { id: 'prop-1' } })
    expect(prisma.propertyImage.deleteMany).toHaveBeenCalledWith({ where: { propertyId: 'prop-1' } })
  })

  test('DELETE /api/properties/:id - forbidden when not owner', async () => {
    prisma.property.findUnique.mockResolvedValue({ id: 'prop-2', ownerId: 'other-owner' })

    const res = await request(app)
      .delete('/api/properties/prop-2')
      .set('Authorization', 'Bearer faketoken')
      .set('x-test-sub', 'owner-1')
      .set('x-test-role', 'OWNER')
      .expect(403)

    expect(res.body.error).toContain('Forbidden')
  })

  test('PUT /api/properties/:id - validation rejects empty title', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'owner-1', role: 'OWNER' })
    prisma.property.findUnique.mockResolvedValue({ id: 'prop-3', ownerId: 'owner-1' })

    const res = await request(app)
      .put('/api/properties/prop-3')
      .set('Authorization', 'Bearer faketoken')
      .set('x-test-sub', 'owner-1')
      .set('x-test-role', 'OWNER')
      .send({ title: '   ' })
      .expect(400)

    expect(res.body.error).toContain('title must not be empty')
  })

  test('PUT /api/properties/:id - validation rejects non-numeric price', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'owner-1', role: 'OWNER' })
    prisma.property.findUnique.mockResolvedValue({ id: 'prop-4', ownerId: 'owner-1' })

    const res = await request(app)
      .put('/api/properties/prop-4')
      .set('Authorization', 'Bearer faketoken')
      .set('x-test-sub', 'owner-1')
      .set('x-test-role', 'OWNER')
      .send({ price: 'not-a-number' })
      .expect(400)

    expect(res.body.error).toContain('price must be a numeric value')
  })

  test('PUT /api/properties/:id - success when owner', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'owner-1', role: 'OWNER' })
    prisma.property.findUnique.mockResolvedValue({ id: 'prop-5', ownerId: 'owner-1' })
    prisma.property.update.mockResolvedValue({ id: 'prop-5', title: 'New title', price: 1000 })

    const res = await request(app)
      .put('/api/properties/prop-5')
      .set('Authorization', 'Bearer faketoken')
      .set('x-test-sub', 'owner-1')
      .set('x-test-role', 'OWNER')
      .send({ title: 'New title', price: 1000 })
      .expect(200)

    expect(res.body.property).toBeDefined()
    expect(prisma.property.update).toHaveBeenCalled()
  })

  test('DELETE /api/properties/:id - succeeds even if unlink fails', async () => {
    const fs = require('fs')
    fs.unlinkSync.mockImplementation(() => { throw new Error('unlink failed') })

    prisma.property.findUnique.mockResolvedValue({ id: 'prop-6', ownerId: 'owner-1' })
    prisma.propertyImage.findMany.mockResolvedValue([{ id: 'img-2', url: 'http://localhost:4000/uploads/test2.jpg' }])
    prisma.propertyImage.deleteMany.mockResolvedValue({ count: 1 })
    prisma.property.delete.mockResolvedValue({ id: 'prop-6' })
    prisma.user.update.mockResolvedValue({ id: 'owner-1', listingCount: 0 })

    const res = await request(app)
      .delete('/api/properties/prop-6')
      .set('Authorization', 'Bearer faketoken')
      .set('x-test-sub', 'owner-1')
      .set('x-test-role', 'OWNER')
      .expect(200)

    expect(res.body.ok).toBe(true)
    expect(prisma.property.delete).toHaveBeenCalledWith({ where: { id: 'prop-6' } })
  })

  test('DELETE /api/properties/:id - admin can delete non-owned property', async () => {
  // property owned by other user
  prisma.property.findUnique.mockResolvedValue({ id: 'prop-7', ownerId: 'other-owner' })

  // Make prisma.user.findUnique return the admin for this test regardless of where shape.
  // Use mockResolvedValueOnce so it only affects this single test and won't interfere with others.
  prisma.user.findUnique.mockResolvedValueOnce({ id: 'admin-1', role: 'ADMIN' })

  prisma.propertyImage.findMany.mockResolvedValue([])
  prisma.property.delete.mockResolvedValue({ id: 'prop-7' })

  const res = await request(app)
    .delete('/api/properties/prop-7')
    .set('Authorization', 'Bearer faketoken')
    .set('x-test-sub', 'admin-1')
    .set('x-test-role', 'ADMIN')
    .expect(200)

  expect(res.body.ok).toBe(true)
  expect(prisma.property.delete).toHaveBeenCalledWith({ where: { id: 'prop-7' } })
})


  test('DELETE /api/properties/:id - unauthorized when acting user not found', async () => {
    prisma.property.findUnique.mockResolvedValue({ id: 'prop-8', ownerId: 'someone' })
    // prisma.user.findUnique will return null by default from mocks
    prisma.user.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .delete('/api/properties/prop-8')
      .set('Authorization', 'Bearer faketoken')
      .set('x-test-sub', 'missing-user')
      .set('x-test-role', 'OWNER')
      .expect(401)

    expect(res.body.error).toContain('Unauthorized')
  })
})
