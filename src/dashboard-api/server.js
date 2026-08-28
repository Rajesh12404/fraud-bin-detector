// server.js
// Express API exposing our pipeline for the dashboard.
// Risk scores are precomputed locally (fast, free). Gemini explanations are
// generated on-demand per transaction and cached, to conserve API quota.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const { extractFeatures } = require('../features/extract-features');
const { computeBaseline } = require('../risk-engine/baseline');
const { computeRiskScore } = require('../risk-engine/score-risk');
const { explainRisk } = require('../ai/explain-risk');
const { applyPolicyGate } = require('../risk-engine/policy-gate');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 4000;

// ---------- LOAD DATA + PRECOMPUTE RISK SCORES ONCE AT STARTUP ----------
const devData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'dev.json')));
const devFeatures = extractFeatures(devData);
const genuineIds = new Set(devData.filter(t => t.scenario === 'GENUINE').map(t => t.transaction_id));
const baseline = computeBaseline(devFeatures, genuineIds);

const lockedTestData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'locked-test.json')));
const lockedTestFeatures = extractFeatures(lockedTestData);

const featuresById = {};
for (const r of lockedTestFeatures) {
  featuresById[r.transaction_id] = r.features;
}

// Precompute risk score for EVERY transaction (fast, local, no API cost)
const transactionsWithRisk = lockedTestData.map(txn => {
  const features = featuresById[txn.transaction_id];
  const riskResult = computeRiskScore(features, baseline);
  return {
    transaction_id: txn.transaction_id,
    timestamp: txn.timestamp,
    amount: txn.amount,
    ip: txn.ip,
    scenario: txn.scenario, // shown for demo/evaluation purposes only, never used in detection logic
    riskScore: riskResult.riskScore,
    classification: riskResult.classification
  };
});

// Cache for Gemini explanations, so we don't re-call the API for the same transaction twice
const explanationCache = {};

// ---------- ENDPOINTS ----------

// Overview stats + list of all transactions with their risk scores (for charts/table)
app.get('/api/overview', (req, res) => {
  const total = transactionsWithRisk.length;
  const highRisk = transactionsWithRisk.filter(t => t.classification === 'HIGH').length;
  const mediumRisk = transactionsWithRisk.filter(t => t.classification === 'MEDIUM').length;
  const failed = lockedTestData.filter(t => t.status === 'failed').length;

  res.json({
    totalTransactions: total,
    failedTransactions: failed,
    highRiskCount: highRisk,
    mediumRiskCount: mediumRisk,
    transactions: transactionsWithRisk
  });
});

// Full pipeline detail for ONE transaction: evidence + Gemini explanation + policy decision
app.get('/api/transaction/:id', async (req, res) => {
  const txnId = req.params.id;
  const txn = lockedTestData.find(t => t.transaction_id === txnId);

  if (!txn) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const features = featuresById[txnId];
  const riskResult = computeRiskScore(features, baseline);

  try {
    // Use cached explanation if we already fetched it before
    let aiResult = explanationCache[txnId];
    if (!aiResult) {
      aiResult = await explainRisk(riskResult, features);
      explanationCache[txnId] = aiResult;
    }

    const finalDecision = applyPolicyGate(riskResult, aiResult);

    res.json({
      transaction_id: txnId,
      features,
      riskResult,
      aiResult,
      finalDecision
    });
  } catch (err) {
    console.error('Error explaining transaction:', err);
    res.status(500).json({ error: 'Failed to generate explanation' });
  }
});

app.listen(PORT, () => {
  console.log(`Dashboard API running at http://localhost:${PORT}`);
});