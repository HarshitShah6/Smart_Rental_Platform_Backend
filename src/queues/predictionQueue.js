// services/backend/src/queues/predictionQueue.js
// Robust Queue + QueueScheduler loader for BullMQ with required ioredis options.

const IORedis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const QUEUE_NAME = process.env.PREDICTION_QUEUE_NAME || 'prediction-queue';

// Important: set maxRetriesPerRequest = null for BullMQ blocking commands
const ioredisOptions = {
  // Keep defaults but enforce this required option
  maxRetriesPerRequest: null,
  // Optional: set connectionName to help debugging
  connectionName: process.env.REDIS_CONNECTION_NAME || 'smart_rental_connection'
};

const connection = new IORedis(REDIS_URL, ioredisOptions);

let QueueClass = null;
let QueueSchedulerClass = null;
let queue = null;
let queueScheduler = null;

try {
  const bullmq = require('bullmq');

  QueueClass = bullmq.Queue || bullmq.default?.Queue || bullmq;
  QueueSchedulerClass = bullmq.QueueScheduler || bullmq.default?.QueueScheduler || bullmq.QueueScheduler;

  if (!QueueClass) {
    throw new Error('Queue class not found on bullmq export');
  }

  if (typeof QueueSchedulerClass === 'function') {
    queueScheduler = new QueueSchedulerClass(QUEUE_NAME, { connection });
    console.log('[predictionQueue] QueueScheduler started');
  } else {
    console.warn('[predictionQueue] QueueScheduler NOT available on installed bullmq. continuing without scheduler.');
  }

  queue = new QueueClass(QUEUE_NAME, { connection });
  console.log('[predictionQueue] Queue created:', QUEUE_NAME);
} catch (err) {
  console.error('[predictionQueue] Failed to initialize bullmq queue/scheduler:', err?.message || err);
  queue = { add: async (name, data, opts) => { console.warn('[predictionQueue] add() called but queue unavailable. job skipped.'); return null; } };
}

async function enqueuePrediction(jobData, opts = {}) {
  if (!queue || typeof queue.add !== 'function') {
    console.warn('[predictionQueue] queue.add not available; job ignored', jobData);
    return null;
  }
  return queue.add('predict', jobData, {
    attempts: opts.attempts ?? 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 1000,
    ...opts
  });
}

module.exports = { enqueuePrediction, queue, queueScheduler, connection };
