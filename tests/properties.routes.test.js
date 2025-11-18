// tests/properties.routes.test.js (very top of file)

// ioredis mock (requires ioredis-mock installed)
jest.mock('ioredis', () => require('ioredis-mock'));

// bullmq lightweight mocks
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ add: jest.fn(), close: jest.fn() })),
  Worker: jest.fn().mockImplementation(() => ({ close: jest.fn() })),
  QueueScheduler: jest.fn().mockImplementation(() => ({ close: jest.fn() }))
}));

// predictionQueue: avoid requiring a queue that needs redis
jest.mock('../src/queues/predictionQueue', () => ({ enqueuePrediction: async () => {} }));

// AUTH - mock several likely import paths using inline factory functions
// Each mock provides initFirebaseAdmin no-op and verifyFirebaseToken that uses test headers.
jest.mock('../src/middleware/auth', () => ({
  initFirebaseAdmin: jest.fn(),
  verifyFirebaseToken: (req, res, next) => {
    const sub = req.headers['x-test-sub'] || 'owner-1';
    const role = req.headers['x-test-role'] || 'OWNER';
    req.firebase = { uid: sub, role };
    next();
  },
}));
jest.mock('../middleware/auth', () => ({
  initFirebaseAdmin: jest.fn(),
  verifyFirebaseToken: (req, res, next) => {
    const sub = req.headers['x-test-sub'] || 'owner-1';
    const role = req.headers['x-test-role'] || 'OWNER';
    req.firebase = { uid: sub, role };
    next();
  },
}));
jest.mock('../src/routes/auth', () => ({
  initFirebaseAdmin: jest.fn(),
  verifyFirebaseToken: (req, res, next) => {
    const sub = req.headers['x-test-sub'] || 'owner-1';
    const role = req.headers['x-test-role'] || 'OWNER';
    req.firebase = { uid: sub, role };
    next();
  },
}));
jest.mock('../routes/auth', () => ({
  initFirebaseAdmin: jest.fn(),
  verifyFirebaseToken: (req, res, next) => {
    const sub = req.headers['x-test-sub'] || 'owner-1';
    const role = req.headers['x-test-role'] || 'OWNER';
    req.firebase = { uid: sub, role };
    next();
  },
}));
jest.mock('src/middleware/auth', () => ({
  initFirebaseAdmin: jest.fn(),
  verifyFirebaseToken: (req, res, next) => {
    const sub = req.headers['x-test-sub'] || 'owner-1';
    const role = req.headers['x-test-role'] || 'OWNER';
    req.firebase = { uid: sub, role };
    next();
  },
}));
jest.mock('src/routes/auth', () => ({
  initFirebaseAdmin: jest.fn(),
  verifyFirebaseToken: (req, res, next) => {
    const sub = req.headers['x-test-sub'] || 'owner-1';
    const role = req.headers['x-test-role'] || 'OWNER';
    req.firebase = { uid: sub, role };
    next();
  },
}));


// // tests/properties.routes.test.js
// // -------------------------------
// // Important: all mocks that affect module import-time behavior must be at the very top,
// // before any `require()` or `import` statements. This file is a fully patched test file.

// // Ensure ioredis calls use the in-memory mock (package must be installed)
// jest.mock('ioredis', () => require('ioredis-mock'));

// // Prevent BullMQ from opening real connections
// jest.mock('bullmq', () => ({
//   Queue: jest.fn().mockImplementation(() => ({
//     add: jest.fn(),
//     close: jest.fn()
//   })),
//   Worker: jest.fn().mockImplementation(() => ({
//     close: jest.fn()
//   })),
//   QueueScheduler: jest.fn().mockImplementation(() => ({
//     close: jest.fn()
//   }))
// }));

// // Mock predictionQueue so properties.js can require it safely (enqueuePrediction will be a no-op)
// jest.mock('../src/queues/predictionQueue', () => ({
//   enqueuePrediction: async () => {}
// }));

// // Mock the middleware that properties router imports so initFirebaseAdmin is a no-op
// // and verifyFirebaseToken sets req.firebase from test headers.
// jest.mock('../src/middleware/auth', () => ({
//   initFirebaseAdmin: jest.fn(), // no-op for import time
//   verifyFirebaseToken: (req, res, next) => {
//     const sub = req.headers['x-test-sub'] || 'owner-1';
//     const role = req.headers['x-test-role'] || 'OWNER';
//     req.firebase = { uid: sub, role };
//     next();
//   },
// }));

// // Now other mocks
// jest.mock('@prisma/client', () => {
//   const mock = {
//     property: {
//       findUnique: jest.fn(),
//       delete: jest.fn(),
//       update: jest.fn(),
//     },
//     propertyImage: {
//       findMany: jest.fn(),
//       deleteMany: jest.fn(),
//     },
//     user: {
//       findUnique: jest.fn(),
//       update: jest.fn(),
//     }
//   }
//   return { PrismaClient: jest.fn(() => mock) }
// })

// jest.mock('fs', () => ({
//   existsSync: jest.fn(() => true),
//   unlinkSync: jest.fn(),
// }))

// Now safe to require test libraries and modules
const request = require('supertest')
const express = require('express')

// Require the router after all mocks are in place
const propertiesRouter = require('../src/routes/properties')

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/properties', propertiesRouter)
  return app
}

describe('Properties routes - ownership and deletion', () => {
  let app
  let prisma
  beforeEach(() => {
    jest.resetModules()
    // require the mocked prisma instance
    const client = require('@prisma/client')
    const PrismaClient = client.PrismaClient
    prisma = new PrismaClient()
    app = createApp()
  })
  prisma.user.findUnique.mockImplementation(({ where }) => {
    if (!where) return Promise.resolve(null)
    const id = where.id
    if (id === 'owner-1') return Promise.resolve({ id: 'owner-1', role: 'OWNER' })
    if (id === 'admin-1') return Promise.resolve({ id: 'admin-1', role: 'ADMIN' })
    return Promise.resolve(null)
  })
  // << END ADD >>

  app = createApp()

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
    // acting user is admin
    prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where && where.id === 'admin-1') return Promise.resolve({ id: 'admin-1', role: 'ADMIN' })
      return Promise.resolve(null)
    })
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
