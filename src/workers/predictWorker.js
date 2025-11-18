// src/workers/predictWorker.js
const { Worker } = require('bullmq')
const axios = require('axios')
const { createRedisClient } = require('../lib/redis')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const connection = createRedisClient()

// Verbose connection logging to help diagnose worker/queue issues
try {
  if (connection && typeof connection.on === 'function') {
    connection.on('connect', () => console.log('[predictWorker][redis] connect'))
    connection.on('ready', () => console.log('[predictWorker][redis] ready'))
    connection.on('error', (err) => console.error('[predictWorker][redis] error', err && err.message ? err.message : err))
    connection.on('close', () => console.log('[predictWorker][redis] close'))
    connection.on('reconnecting', (delay) => console.log('[predictWorker][redis] reconnecting, delay(ms)=', delay))
  }
} catch (e) {
  console.warn('[predictWorker] failed to attach redis listeners', e?.message || e)
}

// ML_BASE from env, default to http://localhost:8000
const ML_BASE = process.env.ML_BASE || 'http://localhost:8000'

function startPredictWorker() {
  try {
    const worker = new Worker('prediction-queue', async job => {
      const { propertyId, payload, features } = job.data
      console.log(`[predictWorker] processing job id=${job.id} propertyId=${propertyId} payloadKeys=${Object.keys(job.data || {}).join(',')}`)

      // fetch property from DB to ensure latest fields
      const property = await prisma.property.findUnique({ where: { id: propertyId } })
      if (!property) throw new Error(`Property ${propertyId} not found`)

      // Build request body expected by ML microservice
      // We'll send a flat object with fields used by model
      const body = {
        ListingID: property.listingId,
        City: property.city,
        Locality: property.locality,
        PropertyType: property.propertyType,
        BHK: property.bhk ?? property.bhk,
        Bathrooms: property.bathrooms,
        Balconies: property.balconies,
        Furnishing: property.furnishing,
        SuperBuiltUpArea_sqft: property.superBuiltUpAreaSqft,
        BuiltUpArea_sqft: property.builtUpAreaSqft,
        CarpetArea_sqft: property.carpetAreaSqft,
        Floor: property.floor,
        TotalFloors: property.totalFloors,
        Parking: property.parking,
        BuildingType: property.buildingType,
        YearBuilt: property.yearBuilt,
        AgeYears: property.ageYears,
        Facing: property.facing,
        AmenitiesCount: property.amenitiesCount,
        IsRERARegistered: property.isReraRegistered,
        RERAID: property.reraId,
        Latitude: property.latitude,
        Longitude: property.longitude,
        // include price if needed / other features
      }

      // call ML service (wrap with detailed logs)
      let resp = null
      try {
        // build a reduced payload for ML: drop ListingID, Locality, SuperBuiltUpArea_sqft, BuiltUpArea_sqft, Latitude, Longitude
        const mlBody = { ...body }
        delete mlBody.ListingID
        delete mlBody.Locality
        delete mlBody.SuperBuiltUpArea_sqft
        delete mlBody.BuiltUpArea_sqft
        delete mlBody.Latitude
        delete mlBody.Longitude

        console.log('[predictWorker] calling ML service at', ML_BASE, 'with body keys=', Object.keys(mlBody || {}).slice(0,20))
        resp = await axios.post(`${ML_BASE}/predict`, mlBody, { timeout: 20000 })
        console.log('[predictWorker] ML response status=', resp.status)
      } catch (mle) {
        console.error('[predictWorker] ML call failed for propertyId=', propertyId, mle?.response?.data || mle?.message || mle)
        throw mle
      }

      const predicted_price = resp?.data?.predicted_price ?? resp?.data?.predicted_price_inr ?? null

      // update DB
      if (predicted_price !== null && predicted_price !== undefined) {
        try {
          await prisma.property.update({ where: { id: propertyId }, data: { predictedRent: Number(predicted_price) } })
          console.log(`[predictWorker] updated predictedRent=${predicted_price} for ${propertyId}`)
        } catch (dberr) {
          console.error('[predictWorker] failed to update DB for', propertyId, dberr?.message || dberr)
        }
      } else {
        console.warn('[predictWorker] ML service returned no prediction for', propertyId, resp?.data)
      }

      return { ok: true }
    }, { connection })

    // More verbose worker lifecycle logging
    worker.on('active', job => console.log('[predictWorker] job active', job.id))
    worker.on('completed', job => console.log('[predictWorker] job completed', job.id))
    worker.on('failed', (job, err) => console.error('[predictWorker] job failed', job?.id, err?.message || err))
    worker.on('error', err => console.error('[predictWorker] worker error', err?.message || err))
    worker.on('drained', () => console.log('[predictWorker] queue drained (no more waiting jobs)'))

    console.log('[predictWorker] worker started; listening on queue=prediction-queue; ML_BASE=', ML_BASE)
  } catch (e) {
    console.error('[predictWorker] error starting worker', e?.message)
  }
}

module.exports = { startPredictWorker }

// If this file is executed directly (npm run worker), start the worker.
if (require.main === module) {
  startPredictWorker()
}





// // services/backend/src/workers/predictWorker.js
// require('dotenv').config();
// const { Worker } = require('bullmq');
// const { connection } = require('../queues/predictionQueue');
// const { predictPrice } = require('../services/predictService');
// const { PrismaClient } = require('@prisma/client');

// const prisma = new PrismaClient();
// const QUEUE_NAME = process.env.PREDICTION_QUEUE_NAME || 'prediction-queue';

// /**
//  * Helpers to coerce types
//  */
// const toFloat = v => {
//   if (v === null || v === undefined) return null;
//   if (typeof v === 'number') return Number.isFinite(v) ? v : null;
//   const n = Number(String(v).replace(/[,₹\s]/g, ''));
//   return Number.isFinite(n) ? n : null;
// };
// const toInt = v => {
//   if (v === null || v === undefined) return null;
//   if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : null;
//   const n = parseInt(String(v).replace(/[,₹\s]/g, ''), 10);
//   return Number.isNaN(n) ? null : n;
// };
// const toBool = v => {
//   if (v === null || v === undefined) return false;
//   if (typeof v === 'boolean') return v;
//   const s = String(v).toLowerCase();
//   return (s === 'true' || s === '1' || s === 'yes');
// };
// const toStr = v => (v === null || v === undefined) ? '' : String(v);

// /**
//  * Map a Prisma property object -> features expected by your ML pipeline.
//  * Keys exactly match the training CSV columns you provided:
//  * City, Locality, PropertyType, BHK, Bathrooms, Balconies, Furnishing,
//  * SuperBuiltUpArea_sqft, BuiltUpArea_sqft, CarpetArea_sqft, Floor, TotalFloors,
//  * Parking, BuildingType, YearBuilt, AgeYears, Facing, AmenitiesCount,
//  * IsRERARegistered, RERAID, Latitude, Longitude
//  */
// function buildFeaturesFromProperty(prop) {
//   // prefer multiple possible DB field names (camelCase, snake_case, variants)
//   const superArea =
//     toFloat(prop.SuperBuiltUpArea_sqft ?? prop.SuperBuiltUpArea ?? prop.superBuiltUpArea ?? prop.superBuiltUpAreaSqft ?? prop.superBuiltUpArea_sqft ?? prop.SuperBuiltUpArea_sqft ?? prop.superarea ?? prop.areaSqft ?? null);
//   const builtUp =
//     toFloat(prop.BuiltUpArea_sqft ?? prop.builtUpAreaSqft ?? prop.builtUpArea_sqft ?? prop.builtUpSqft ?? prop.builtUp ?? null);
//   const carpet =
//     toFloat(prop.CarpetArea_sqft ?? prop.CarpetAreaSqft ?? prop.carpetArea_sqft ?? prop.carpetArea ?? null);

//   const parkingVal = prop.Parking ?? prop.parking ?? prop.parking_spaces ?? null;

//   return {
//     City: toStr(prop.City ?? prop.city ?? ''),
//     Locality: toStr(prop.Locality ?? prop.locality ?? prop.neighborhood ?? ''),
//     PropertyType: toStr(prop.PropertyType ?? prop.propertyType ?? ''),
//     BHK: toInt(prop.BHK ?? prop.bhk ?? prop.Bedrooms ?? prop.bedrooms ?? null),
//     Bathrooms: toInt(prop.Bathrooms ?? prop.bathrooms ?? null),
//     Balconies: toInt(prop.Balconies ?? prop.balconies ?? null),
//     Furnishing: toStr(prop.Furnishing ?? prop.furnishing ?? ''),
//     SuperBuiltUpArea_sqft: superArea,
//     BuiltUpArea_sqft: builtUp,
//     CarpetArea_sqft: carpet,
//     Floor: toInt(prop.Floor ?? prop.floor ?? null),
//     TotalFloors: toInt(prop.TotalFloors ?? prop.totalFloors ?? prop.total_floors ?? null),
//     Parking: (typeof parkingVal === 'number' ? toInt(parkingVal) : toStr(parkingVal)),
//     BuildingType: toStr(prop.BuildingType ?? prop.buildingType ?? ''),
//     YearBuilt: toInt(prop.YearBuilt ?? prop.yearBuilt ?? null),
//     AgeYears: toFloat(prop.AgeYears ?? prop.ageYears ?? null),
//     Facing: toStr(prop.Facing ?? prop.facing ?? ''),
//     AmenitiesCount: toInt(prop.AmenitiesCount ?? prop.amenitiesCount ?? null),
//     IsRERARegistered: toBool(prop.IsRERARegistered ?? prop.isReraRegistered ?? prop.isRera ?? false),
//     RERAID: toStr(prop.RERAID ?? prop.reraId ?? ''),
//     Latitude: toFloat(prop.Latitude ?? prop.latitude ?? null),
//     Longitude: toFloat(prop.Longitude ?? prop.longitude ?? null)
//   };
// }

// /**
//  * Worker processor
//  */
// const worker = new Worker(
//   QUEUE_NAME,
//   async job => {
//     console.log('[predictWorker] processing job', job.id, 'data:', job.data);
//     const { propertyId, features: providedFeatures } = job.data;

//     // Fetch the latest property from DB
//     const prop = await prisma.property.findUnique({ where: { id: propertyId } });
//     if (!prop) {
//       console.warn(`[predictWorker] property ${propertyId} not found`);
//       return { status: 'skipped', reason: 'missing-property' };
//     }

//     // Use provided features if present (fast-path), otherwise build from DB
//     const features = (providedFeatures && typeof providedFeatures === 'object')
//       ? providedFeatures
//       : buildFeaturesFromProperty(prop);

//     // Call ML service
//     const mlResp = await predictPrice(features);
//     if (!mlResp || typeof mlResp.predicted_price === 'undefined' || mlResp.predicted_price === null) {
//       throw new Error('ML service returned no prediction');
//     }

//     const predicted = Math.round(mlResp.predicted_price);
//     const now = new Date();

//     // Update property with predicted rent & timestamp
//     await prisma.property.update({
//       where: { id: propertyId },
//       data: {
//         predictedRent: predicted,
//         predictedAt: now
//       }
//     });

//     console.log(`[predictWorker] property ${propertyId} updated predictedRent=${predicted}`);
//     return { status: 'ok', predicted, model_version: mlResp.model_version || null };
//   },
//   { connection, concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10) }
// );

// worker.on('completed', job => console.log('[predictWorker] completed', job.id));
// worker.on('failed', (job, err) => console.error('[predictWorker] failed', job.id, err?.message || err));

// const shutdown = async () => {
//   console.log('[predictWorker] shutting down...');
//   await worker.close();
//   await prisma.$disconnect();
//   process.exit(0);
// };

// process.on('SIGINT', shutdown);
// process.on('SIGTERM', shutdown);
