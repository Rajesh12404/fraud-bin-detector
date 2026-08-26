// diagnose-misses.js
// Finds every ATTACK transaction that our detector did NOT classify as HIGH,
// and prints their feature values — so we can see WHY they were missed,
// instead of guessing.

const fs = require('fs');
const path = require('path');
const { extractFeatures } = require('../features/extract-features');
const { computeBaseline } = require('./baseline');
const { computeRiskScore } = require('./score-risk');

const devData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'dev.json')));
const devFeatures = extractFeatures(devData);
const genuineIds = new Set(devData.filter(t => t.scenario === 'GENUINE').map(t => t.transaction_id));
const baseline = computeBaseline(devFeatures, genuineIds);

const validationData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'validation.json')));
const validationFeatures = extractFeatures(validationData);

const featuresById = {};
for (const r of validationFeatures) {
  featuresById[r.transaction_id] = r.features;
}

const missedAttacks = [];

for (const txn of validationData) {
  if (txn.label !== 'ATTACK') continue; // only care about actual attacks

  const features = featuresById[txn.transaction_id];
  const result = computeRiskScore(features, baseline);

  if (result.classification !== 'HIGH') {
    missedAttacks.push({
      transaction_id: txn.transaction_id,
      classification: result.classification,
      riskScore: result.riskScore,
      features
    });
  }
}

console.log('Total missed attacks:', missedAttacks.length);
console.log('\nFirst 10 missed attacks (feature values):');
missedAttacks.slice(0, 10).forEach(m => {
  console.log(`\n${m.transaction_id} | classification: ${m.classification} | score: ${m.riskScore}`);
  console.log(m.features);
});

// Quick stats: what's the AVERAGE velocity5m/uniqueCards5m among missed attacks?
// If these are all low, it confirms the "no history yet" theory.
const avgVelocity = missedAttacks.reduce((sum, m) => sum + m.features.velocity5m, 0) / missedAttacks.length;
const avgUniqueCards = missedAttacks.reduce((sum, m) => sum + m.features.uniqueCards5m, 0) / missedAttacks.length;

console.log('\n--- Averages among ALL missed attacks ---');
console.log('Average velocity5m:', avgVelocity.toFixed(2));
console.log('Average uniqueCards5m:', avgUniqueCards.toFixed(2));