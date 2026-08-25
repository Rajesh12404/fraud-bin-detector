// test-features.js
// Loads the dev dataset, extracts features, and compares a GENUINE transaction
// against an ATTACK transaction to confirm the feature differences are obvious.

const fs = require('fs');
const path = require('path');
const { extractFeatures } = require('./extract-features');

const devData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'dev.json')));

console.log('Loaded transactions:', devData.length);

const featureResults = extractFeatures(devData);

// Build a quick lookup so we can find features by transaction_id
const featuresById = {};
for (const r of featureResults) {
  featuresById[r.transaction_id] = r.features;
}

// Find one GENUINE transaction and one CARD_TESTING (attack) transaction to compare
const genuineExample = devData.find(t => t.scenario === 'GENUINE');
// Get ALL attack transactions, then pick the 15th one (not the very first),
// so we're looking at a point mid-burst where the pattern has built up
const attackTransactions = devData.filter(t => t.scenario === 'CARD_TESTING');
const attackExample = attackTransactions[14];

console.log('\n--- GENUINE transaction features ---');
console.log('Transaction:', genuineExample.transaction_id, '| IP:', genuineExample.ip);
console.log(featuresById[genuineExample.transaction_id]);

console.log('\n--- ATTACK (CARD_TESTING) transaction features ---');
console.log('Transaction:', attackExample.transaction_id, '| IP:', attackExample.ip);
console.log(featuresById[attackExample.transaction_id]);