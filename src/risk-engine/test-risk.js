// test-risk.js
// Loads dev data, extracts features, builds a baseline from GENUINE transactions,
// then scores ONE representative transaction from EACH of the 4 scenarios —
// to confirm genuine/outage/flash-sale all score LOW, and only card-testing scores HIGH.

const fs = require('fs');
const path = require('path');
const { extractFeatures } = require('../features/extract-features');
const { computeBaseline } = require('./baseline');
const { computeRiskScore } = require('./score-risk');

const devData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'dev.json')));
const featureResults = extractFeatures(devData);

const featuresById = {};
for (const r of featureResults) {
  featuresById[r.transaction_id] = r.features;
}

const genuineIds = new Set(devData.filter(t => t.scenario === 'GENUINE').map(t => t.transaction_id));
const baseline = computeBaseline(featureResults, genuineIds);

console.log('Baseline (normal behavior):', baseline);

// Helper: get the Nth transaction of a given scenario (default: 10th, to ensure
// we're picking one from mid-burst, not the very first with no history yet)
function getScenarioExample(scenario, index = 10) {
  const matches = devData.filter(t => t.scenario === scenario);
  return matches[Math.min(index, matches.length - 1)];
}

const scenarios = ['GENUINE', 'CARD_TESTING', 'BANK_OUTAGE', 'FLASH_SALE'];

for (const scenario of scenarios) {
  const example = getScenarioExample(scenario);
  const result = computeRiskScore(featuresById[example.transaction_id], baseline);

  console.log(`\n--- ${scenario} (txn: ${example.transaction_id}) ---`);
  console.log(result);
}