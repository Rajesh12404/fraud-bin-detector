// test-policy.js
// Runs the FULL pipeline end-to-end: risk engine → AI explainer → policy gate,
// for one attack transaction and one genuine transaction.

const fs = require('fs');
const path = require('path');
const { extractFeatures } = require('../features/extract-features');
const { computeBaseline } = require('./baseline');
const { computeRiskScore } = require('./score-risk');
const { explainRisk } = require('../ai/explain-risk');
const { applyPolicyGate } = require('./policy-gate');

async function main() {
  const devData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'dev.json')));
  const devFeatures = extractFeatures(devData);
  const genuineIds = new Set(devData.filter(t => t.scenario === 'GENUINE').map(t => t.transaction_id));
  const baseline = computeBaseline(devFeatures, genuineIds);

  const featuresById = {};
  for (const r of devFeatures) {
    featuresById[r.transaction_id] = r.features;
  }

  const allAttackTxns = devData.filter(t => t.scenario === 'CARD_TESTING');
  const attackExample = allAttackTxns[10];
  const attackFeatures = featuresById[attackExample.transaction_id];
  const attackRiskResult = computeRiskScore(attackFeatures, baseline);
  const attackAiResult = await explainRisk(attackRiskResult, attackFeatures);
  const attackFinal = applyPolicyGate(attackRiskResult, attackAiResult);

  console.log('--- FULL PIPELINE: ATTACK TRANSACTION ---');
  console.log(attackFinal);

  const genuineExample = devData.find(t => t.scenario === 'GENUINE');
  const genuineFeatures = featuresById[genuineExample.transaction_id];
  const genuineRiskResult = computeRiskScore(genuineFeatures, baseline);
  const genuineAiResult = await explainRisk(genuineRiskResult, genuineFeatures);
  const genuineFinal = applyPolicyGate(genuineRiskResult, genuineAiResult);

  console.log('\n--- FULL PIPELINE: GENUINE TRANSACTION ---');
  console.log(genuineFinal);
}

main().catch(err => console.error('Error:', err));