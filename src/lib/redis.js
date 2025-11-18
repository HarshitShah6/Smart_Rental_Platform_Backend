// src/lib/redis.js
const Redis = require('ioredis')

function createRedisClient() {
  const host = process.env.REDIS_HOST || '127.0.0.1'
  const port = Number(process.env.REDIS_PORT || 6379)
  const password = process.env.REDIS_PASSWORD || undefined

  // Important: maxRetriesPerRequest must be null for BullMQ per its check.
  return new Redis({
    host,
    port,
    password,
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
  })
}

module.exports = { createRedisClient }
