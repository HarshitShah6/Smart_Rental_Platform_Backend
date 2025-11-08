const axios = require('axios')

const ML_BASE = process.env.ML_BASE || 'http://localhost:8000'

async function checkFraudAndPredictRent(property) {
  try {
    const resp = await axios.post(`${ML_BASE}/predict`, { property })
    return resp.data
  } catch (err) {
    console.error('ML service error', err?.message)
    return { fraudScore: 0, predictedRent: property.price }
  }
}

module.exports = { checkFraudAndPredictRent }
