// services/backend/src/services/predictService.js
const axios = require('axios');

const ML_BASE = process.env.ML_BASE || 'http://localhost:8000';
const ML_TIMEOUT = parseInt(process.env.ML_TIMEOUT || '8000', 10);

/**
 * Call ML service /predict with provided features.
 * @param {Object} features - Plain JS object of model features (keys must match training columns)
 * @returns {Object|null} - response data from ML service, for example:
 *   { predicted_price: number, predicted_price_scaled: number, model_version: string }
 *   or null on error
 */
async function predictPrice(features) {
  try {
    const resp = await axios.post(`${ML_BASE}/predict`, features, {
      timeout: ML_TIMEOUT,
      headers: { 'Content-Type': 'application/json' }
    });
    return resp.data || null;
  } catch (err) {
    console.error('predictPrice error:', err?.response?.data || err.message);
    return null;
  }
}

module.exports = { predictPrice };
