// test-explain.js
// Tests the Gemini explainer using one real GENUINE and one real CARD_TESTING
// transaction's evidence, pulled from our actual pipeline.

const fs = require('fs');
const path = require('path');
const { extractFeatures } = require('../features/extract-features');
const { computeBaseline } = require('../risk-engine/baseline');
const { computeRiskScore } = require('../risk-engine/score-risk');
const { explainRisk } = require('./explain-risk');

async function main() {
  const devData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'dev.json')));
  const devFeatures = extractFeatures(devData);
  const genuineIds = new Set(devData.filter(t => t.scenario === 'GENUINE').map(t => t.transaction_id));
  const baseline = computeBaseline(devFeatures, genuineIds);

  const featuresById = {};
  for (const r of devFeatures) {
    featuresById[r.transaction_id] = r.features;
  }

  // Grab a mid-burst attack transaction, same as our earlier tests
  const allAttackTxns = devData.filter(t => t.scenario === 'CARD_TESTING');
  const attackExample = allAttackTxns[10];
  const attackFeatures = featuresById[attackExample.transaction_id];
  const attackRiskResult = computeRiskScore(attackFeatures, baseline);

  console.log('--- Risk engine result (attack) ---');
  console.log(attackRiskResult);

  console.log('\n--- Calling Gemini for explanation... ---');
  const explanation = await explainRisk(attackRiskResult, attackFeatures);
  console.log(explanation);

    // Now test a GENUINE transaction — should classify as low-risk, allow recovery
  const genuineExample = devData.find(t => t.scenario === 'GENUINE');
  const genuineFeatures = featuresById[genuineExample.transaction_id];
  const genuineRiskResult = computeRiskScore(genuineFeatures, baseline);

  console.log('\n--- Risk engine result (genuine) ---');
  console.log(genuineRiskResult);

  console.log('\n--- Calling Gemini for explanation... ---');
  const genuineExplanation = await explainRisk(genuineRiskResult, genuineFeatures);
  console.log(genuineExplanation);
}

main().catch(err => console.error('Error:', err));