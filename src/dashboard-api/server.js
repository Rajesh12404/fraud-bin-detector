// server.js
// Express API exposing the complete RiskShield fraud pipeline.
//
// Two live entry points:
//   1. Razorpay webhook
//   2. Live Transaction Simulator
//
// Both are processed through the SAME pipeline:
// transaction -> feature extraction -> risk engine -> Gemini -> policy gate

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

// ============================================================
// LOAD DATA + BUILD BASELINE
// ============================================================

const devData = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', '..', 'data', 'dev.json')
  )
);

const devFeatures = extractFeatures(devData);

const genuineIds = new Set(
  devData
    .filter(t => t.scenario === 'GENUINE')
    .map(t => t.transaction_id)
);

const baseline = computeBaseline(devFeatures, genuineIds);

// ============================================================
// LOCKED TEST DATA
// ============================================================

const lockedTestData = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', '..', 'data', 'locked-test.json')
  )
);

const lockedTestFeatures = extractFeatures(lockedTestData);

const featuresById = {};

for (const r of lockedTestFeatures) {
  featuresById[r.transaction_id] = r.features;
}

// ============================================================
// PRECOMPUTE LOCKED TEST RISK SCORES
// ============================================================

const transactionsWithRisk = lockedTestData.map(txn => {
  const features = featuresById[txn.transaction_id];

  const riskResult = computeRiskScore(
    features,
    baseline
  );

  return {
    transaction_id: txn.transaction_id,
    timestamp: txn.timestamp,
    amount: txn.amount,
    ip: txn.ip,
    scenario: txn.scenario,

    riskScore: riskResult.riskScore,
    classification: riskResult.classification
  };
});

// ============================================================
// GEMINI CACHE
// ============================================================

const explanationCache = {};

// ============================================================
// LIVE EVENT HISTORY
// ============================================================
//
// This contains transactions received through:
//   - Razorpay webhook
//   - Manual Live Transaction Simulator
//
// It is intentionally in-memory for the demo.
// Restarting the server clears this history.
//

let liveEvents = [];

const MAX_LIVE_EVENTS = 200;

// ============================================================
// SHARED LIVE PIPELINE
// ============================================================
//
// BOTH Razorpay and the manual simulator call this function.
//
// This is important architecturally:
// we don't have two different fraud engines.
//

async function processLiveTransaction(transaction) {
  // Add the new transaction to recent live history.
  liveEvents.push(transaction);

  // Keep memory bounded.
  if (liveEvents.length > MAX_LIVE_EVENTS) {
    liveEvents = liveEvents.slice(-MAX_LIVE_EVENTS);
  }

  // extractFeatures requires ascending timestamp order.
  liveEvents.sort(
    (a, b) => a.timestamp - b.timestamp
  );

  // Run the ACTUAL feature extractor.
  const liveFeatures = extractFeatures(liveEvents);

  const featureRecord = liveFeatures.find(
    f => f.transaction_id === transaction.transaction_id
  );

  if (!featureRecord) {
    throw new Error(
      'Unable to extract features for live transaction'
    );
  }

  const features = featureRecord.features;

  // Deterministic risk engine.
  const riskResult = computeRiskScore(
    features,
    baseline
  );

  // Gemini is advisory only.
  const aiResult = await explainRisk(
    riskResult,
    features
  );

  // Deterministic policy gate has final authority.
  const finalDecision = applyPolicyGate(
    riskResult,
    aiResult
  );

  return {
    transaction,
    features,
    riskResult,
    aiResult,
    finalDecision
  };
}

// ============================================================
// OVERVIEW
// ============================================================

app.get('/api/overview', (req, res) => {
  const total = transactionsWithRisk.length;

  const highRisk = transactionsWithRisk.filter(
    t => t.classification === 'HIGH'
  ).length;

  const mediumRisk = transactionsWithRisk.filter(
    t => t.classification === 'MEDIUM'
  ).length;

  const failed = lockedTestData.filter(
    t => t.status === 'failed'
  ).length;

  res.json({
    totalTransactions: total,
    failedTransactions: failed,
    highRiskCount: highRisk,
    mediumRiskCount: mediumRisk,
    transactions: transactionsWithRisk
  });
});

// ============================================================
// TRANSACTION DETAIL
// ============================================================

app.get('/api/transaction/:id', async (req, res) => {
  const txnId = req.params.id;

  const txn = lockedTestData.find(
    t => t.transaction_id === txnId
  );

  if (!txn) {
    return res.status(404).json({
      error: 'Transaction not found'
    });
  }

  const features = featuresById[txnId];

  const riskResult = computeRiskScore(
    features,
    baseline
  );

  try {
    let aiResult = explanationCache[txnId];

    if (!aiResult) {
      aiResult = await explainRisk(
        riskResult,
        features
      );

      explanationCache[txnId] = aiResult;
    }

    const finalDecision = applyPolicyGate(
      riskResult,
      aiResult
    );

    res.json({
      transaction_id: txnId,
      features,
      riskResult,
      aiResult,
      finalDecision
    });
  } catch (err) {
    console.error(
      'Error explaining transaction:',
      err
    );

    res.status(500).json({
      error: 'Failed to generate explanation'
    });
  }
});

// ============================================================
// MODEL EVALUATION
// ============================================================

app.get('/api/evaluation', (req, res) => {
  let truePositive = 0;
  let falsePositive = 0;
  let trueNegative = 0;
  let falseNegative = 0;

  lockedTestData.forEach(txn => {
    const features = featuresById[txn.transaction_id];

    const riskResult = computeRiskScore(
      features,
      baseline
    );

    const actualFraud =
      txn.scenario === 'CARD_TESTING';

    const predictedFraud =
      riskResult.classification === 'HIGH';

    if (actualFraud && predictedFraud) {
      truePositive++;
    } else if (actualFraud && !predictedFraud) {
      falseNegative++;
    } else if (!actualFraud && predictedFraud) {
      falsePositive++;
    } else {
      trueNegative++;
    }
  });

  const precision =
    truePositive + falsePositive > 0
      ? truePositive /
        (truePositive + falsePositive)
      : 0;

  const recall =
    truePositive + falseNegative > 0
      ? truePositive /
        (truePositive + falseNegative)
      : 0;

  const accuracy =
    (truePositive + trueNegative) /
    (
      truePositive +
      trueNegative +
      falsePositive +
      falseNegative
    );

  res.json({
    total: lockedTestData.length,

    precision,
    recall,
    accuracy,

    confusionMatrix: {
      truePositive,
      falsePositive,
      trueNegative,
      falseNegative
    }
  });
});

// ============================================================
// RAZORPAY WEBHOOK
// ============================================================
//
// Razorpay -> ngrok -> this endpoint
//
// IMPORTANT:
// The mapped Razorpay transaction now goes through the SAME
// processLiveTransaction() used by the manual simulator.
//

app.post(
  '/api/webhook/razorpay',
  async (req, res) => {
    try {
      console.log(
        'Received Razorpay webhook event:',
        req.body.event
      );

      const payload = req.body.payload;

      if (
        !payload ||
        !payload.payment ||
        !payload.payment.entity
      ) {
        return res.status(400).json({
          error: 'Unexpected payload shape'
        });
      }

      const razorpayPayment =
        payload.payment.entity;

      // Map Razorpay's schema into OUR transaction schema.
      const mappedTransaction = {
        transaction_id:
          razorpayPayment.id,

        timestamp:
          razorpayPayment.created_at * 1000,

        amount:
          razorpayPayment.amount / 100,

        ip:
          razorpayPayment.notes?.ip ||
          `razorpay_${razorpayPayment.id}`,

        card_id:
          razorpayPayment.card_id ||
          'unknown_card',

        bin:
          razorpayPayment.card?.iin ||
          '00000000',

        status:
          razorpayPayment.status === 'failed'
            ? 'failed'
            : 'success',

        device_id:
          'razorpay_live_event'
      };

      console.log(
        'Mapped into our pipeline:',
        mappedTransaction
      );

      // Run through the REAL fraud pipeline.
      const result =
        await processLiveTransaction(
          mappedTransaction
        );

      console.log(
        'Razorpay pipeline result:',
        result.finalDecision
      );

      // Respond to Razorpay with the result.
      res.status(200).json({
        received: true,

        transaction:
          result.transaction,

        riskResult:
          result.riskResult,

        aiResult:
          result.aiResult,

        finalDecision:
          result.finalDecision
      });

    } catch (err) {
      console.error(
        'Razorpay webhook processing error:',
        err
      );

      res.status(500).json({
        error:
          'Failed to process Razorpay transaction'
      });
    }
  }
);

// ============================================================
// LIVE TRANSACTION SIMULATOR
// ============================================================
//
// Dashboard -> POST /api/simulate-transaction
//
// This intentionally accepts SAFE TEST IDENTIFIERS rather than
// raw card numbers/CVV.
//

app.post(
  '/api/simulate-transaction',
  async (req, res) => {
    try {
      const {
        amount,
        ip,
        card_id,
        bin,
        status
      } = req.body;

      // --------------------------------------------------------
      // VALIDATION
      // --------------------------------------------------------

      if (
        amount === undefined ||
        amount === null ||
        amount === '' ||
        !ip ||
        !card_id ||
        !bin ||
        !status
      ) {
        return res.status(400).json({
          error:
            'Missing required fields: amount, ip, card_id, bin, status'
        });
      }

      const numericAmount = Number(amount);

      if (
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
      ) {
        return res.status(400).json({
          error:
            'Amount must be a positive number'
        });
      }

      if (
        status !== 'failed' &&
        status !== 'success'
      ) {
        return res.status(400).json({
          error:
            'Status must be either failed or success'
        });
      }

      // Keep BIN as a test identifier.
      const cleanBin = String(bin).trim();

      if (
        cleanBin.length < 4 ||
        cleanBin.length > 8
      ) {
        return res.status(400).json({
          error:
            'BIN must contain 4 to 8 characters'
        });
      }

      // --------------------------------------------------------
      // CREATE TRANSACTION
      // --------------------------------------------------------

      const newTxn = {
        transaction_id:
          'live_' + Date.now(),

        timestamp:
          Date.now(),

        amount:
          numericAmount,

        ip:
          String(ip).trim(),

        card_id:
          String(card_id).trim(),

        bin:
          cleanBin,

        status,

        device_id:
          'manual_live_test'
      };

      console.log(
        'Live simulator transaction:',
        newTxn
      );

      // --------------------------------------------------------
      // SAME PIPELINE AS RAZORPAY
      // --------------------------------------------------------

      const result =
        await processLiveTransaction(
          newTxn
        );

      console.log(
        'Live simulator result:',
        result.finalDecision
      );

      res.status(200).json(result);

    } catch (err) {
      console.error(
        'Error in live simulation:',
        err
      );

      res.status(500).json({
        error:
          'Failed to process transaction'
      });
    }
  }
);

// ============================================================
// LIVE HISTORY — USEFUL FOR DASHBOARD
// ============================================================

app.get('/api/live-events', (req, res) => {
  res.json({
    count: liveEvents.length,
    transactions: liveEvents
  });
});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'RiskShield Dashboard API',
    liveEvents: liveEvents.length,
    timestamp: Date.now()
  });
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
  console.log(
    `Dashboard API running at http://localhost:${PORT}`
  );
});