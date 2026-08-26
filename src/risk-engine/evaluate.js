// evaluate.js
// Runs the risk engine against EVERY transaction in a dataset and computes
// real precision, recall, F1, and false-positive rate — comparing our
// HIGH/MEDIUM/LOW classification against the actual ground-truth label.

const fs = require('fs');
const path = require('path');
const { extractFeatures } = require('../features/extract-features');
const { computeBaseline } = require('./baseline');
const { computeRiskScore } = require('./score-risk');

// We treat "HIGH" as our detector's positive prediction (flagged as attack).
// LOW and MEDIUM both count as "not flagged" for this first evaluation —
// we can revisit this decision later once we see the numbers.
function evaluateDataset(datasetPath, baseline) {
  const data = JSON.parse(fs.readFileSync(datasetPath));
  const featureResults = extractFeatures(data);

  const featuresById = {};
  for (const r of featureResults) {
    featuresById[r.transaction_id] = r.features;
  }

  let truePositives = 0;  // predicted HIGH, actually ATTACK
  let falsePositives = 0; // predicted HIGH, actually GENUINE
  let trueNegatives = 0;  // predicted NOT-HIGH, actually GENUINE
  let falseNegatives = 0; // predicted NOT-HIGH, actually ATTACK

  // Track false positives BY SCENARIO — this tells us WHICH edge case
  // is causing problems, if any (bank outage vs flash sale vs something else)
  const falsePositivesByScenario = {};

  for (const txn of data) {
    const features = featuresById[txn.transaction_id];
    const result = computeRiskScore(features, baseline);

    const predictedAttack = result.classification === 'HIGH';
    const actuallyAttack = txn.label === 'ATTACK';

    if (predictedAttack && actuallyAttack) {
      truePositives++;
    } else if (predictedAttack && !actuallyAttack) {
      falsePositives++;
      falsePositivesByScenario[txn.scenario] = (falsePositivesByScenario[txn.scenario] || 0) + 1;
    } else if (!predictedAttack && !actuallyAttack) {
      trueNegatives++;
    } else if (!predictedAttack && actuallyAttack) {
      falseNegatives++;
    }
  }

  // Precision: of everything we FLAGGED, how much was actually an attack?
  const precision = truePositives / (truePositives + falsePositives) || 0;

  // Recall: of all ACTUAL attacks, how many did we catch?
  const recall = truePositives / (truePositives + falseNegatives) || 0;

  // F1: harmonic mean of precision and recall — a single balanced score
  const f1 = (2 * precision * recall) / (precision + recall) || 0;

  // False positive rate: of everything that was actually genuine, how much did we WRONGLY flag?
  const falsePositiveRate = falsePositives / (falsePositives + trueNegatives) || 0;

  return {
    totalTransactions: data.length,
    truePositives,
    falsePositives,
    trueNegatives,
    falseNegatives,
    precision: Number(precision.toFixed(3)),
    recall: Number(recall.toFixed(3)),
    f1: Number(f1.toFixed(3)),
    falsePositiveRate: Number(falsePositiveRate.toFixed(3)),
    falsePositivesByScenario
  };
}

// Build baseline from DEV set's genuine transactions (our "training" data)
const devData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'dev.json')));
const devFeatures = extractFeatures(devData);
const genuineIds = new Set(devData.filter(t => t.scenario === 'GENUINE').map(t => t.transaction_id));
const baseline = computeBaseline(devFeatures, genuineIds);

console.log('Baseline (built from dev set):', baseline);

console.log('\n=== VALIDATION SET EVALUATION ===');

const validationResults = evaluateDataset(
  path.join(__dirname, '..', '..', 'data', 'validation.json'),
  baseline
);

console.log(validationResults);


console.log('\n=== LOCKED TEST SET EVALUATION ===');

const lockedTestResults = evaluateDataset(
  path.join(__dirname, '..', '..', 'data', 'locked-test.json'),
  baseline
);

console.log(lockedTestResults);