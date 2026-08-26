// explain-risk.js
// Sends the risk engine's structured evidence to Gemini, which returns a
// human-readable explanation and a recommended action — as structured JSON.
// Gemini NEVER decides the risk score itself; it only interprets evidence
// that the risk engine already computed.

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

// Builds the prompt that tells Gemini exactly what to do and how to respond.
function buildPrompt(riskResult, features) {
  return `You are an AI Risk Manager assistant for a payment fraud detection system.
You will be given VERIFIED EVIDENCE already computed by a separate rules-based risk engine.
You do NOT decide the risk score. You only explain the evidence and recommend an action.

EVIDENCE:
Risk Score: ${riskResult.riskScore}/100
Classification: ${riskResult.classification}
Rules Fired: ${riskResult.firedRules.join(', ') || 'none'}
Features:
- Velocity (attempts in last 5 min from this IP): ${features.velocity5m}
- Unique cards tried from this IP (5 min): ${features.uniqueCards5m}
- Unique IPs targeting this BIN (15 min): ${features.uniqueIPsForBin15m}
- Decline rate (15 min window): ${(features.declineRate15m * 100).toFixed(1)}%
- Small-amount ratio (15 min window): ${(features.smallAmountRatio * 100).toFixed(1)}%
- Velocity anomaly z-score: ${riskResult.velocityZScore}
- Decline rate anomaly z-score: ${riskResult.declineZScore}

Respond with ONLY a valid JSON object, no other text, in exactly this format:
{
  "classification": "CARD_TESTING" or "SUSPICIOUS" or "GENUINE_FAILURE",
  "explanation": "a 2-3 sentence plain-language explanation of why this evidence looks the way it does",
  "recommended_action": "BLOCK_RECOVERY" or "MONITOR" or "ALLOW_RECOVERY"
}`;
}

async function explainRisk(riskResult, features) {
  const prompt = buildPrompt(riskResult, features);

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  // Gemini sometimes wraps JSON in markdown code fences — strip those if present
  const cleaned = responseText.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Failed to parse Gemini response as JSON:', responseText);
    throw err;
  }
}

module.exports = { explainRisk };