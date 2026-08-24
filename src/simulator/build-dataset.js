// build-dataset.js
// Assembles a realistic, timestamp-sorted dataset combining genuine transactions,
// attack bursts, and edge cases — then splits it into dev/validation/locked-test
// using STRATIFIED sampling, so every scenario type is proportionally represented
// in all three splits. This is critical: a purely time-based split could accidentally
// leave the locked test set with too few (or zero) attack examples, making any
// precision/recall we report on it meaningless.

const fs = require('fs');
const path = require('path');
const {
  generateGenuineTransaction,
  generateAttackBurst,
  generateBankOutageBurst,
  generateFlashSaleBurst
} = require('./generator');

const NUM_GENUINE_TRANSACTIONS = 4000;
const NUM_ATTACK_BURSTS = 40;
const NUM_OUTAGE_EVENTS = 10;
const NUM_FLASHSALE_EVENTS = 10;

const START_TIME = Date.now() - 7 * 24 * 60 * 60 * 1000;
const END_TIME = Date.now();
const TOTAL_WINDOW = END_TIME - START_TIME;

function randomTimestampInWindow() {
  return START_TIME + Math.floor(Math.random() * TOTAL_WINDOW);
}

// Splits an ARRAY OF EVENTS (not individual transactions) into dev/validation/locked-test
// by percentage. We split at the EVENT level (one genuine transaction = one event,
// one attack burst = one event) so an entire burst always stays together in one split —
// we never want half an attack burst in dev and half in test.
function splitEvents(events, devRatio, valRatio) {
  const total = events.length;
  const devEnd = Math.floor(total * devRatio);
  const valEnd = devEnd + Math.floor(total * valRatio);
  return {
    dev: events.slice(0, devEnd),
    validation: events.slice(devEnd, valEnd),
    lockedTest: events.slice(valEnd)
  };
}

// Flattens an array of "events" (where each event is either one transaction object,
// or an array of transactions from a burst) into one flat array of transactions.
function flattenEvents(events) {
  let flat = [];
  for (const event of events) {
    if (Array.isArray(event)) {
      flat = flat.concat(event);
    } else {
      flat.push(event);
    }
  }
  return flat;
}

function buildStratifiedDataset() {
  const genuineEvents = [];
  for (let i = 0; i < NUM_GENUINE_TRANSACTIONS; i++) {
    genuineEvents.push(generateGenuineTransaction(randomTimestampInWindow()));
  }

  const attackEvents = [];
  for (let i = 0; i < NUM_ATTACK_BURSTS; i++) {
    attackEvents.push(generateAttackBurst(randomTimestampInWindow()));
  }

  const outageEvents = [];
  for (let i = 0; i < NUM_OUTAGE_EVENTS; i++) {
    outageEvents.push(generateBankOutageBurst(randomTimestampInWindow()));
  }

  const flashSaleEvents = [];
  for (let i = 0; i < NUM_FLASHSALE_EVENTS; i++) {
    flashSaleEvents.push(generateFlashSaleBurst(randomTimestampInWindow()));
  }

  const genuineSplit = splitEvents(genuineEvents, 0.70, 0.15);
  const attackSplit = splitEvents(attackEvents, 0.70, 0.15);
  const outageSplit = splitEvents(outageEvents, 0.70, 0.15);
  const flashSaleSplit = splitEvents(flashSaleEvents, 0.70, 0.15);

  const devTransactions = flattenEvents([
    ...genuineSplit.dev, ...attackSplit.dev, ...outageSplit.dev, ...flashSaleSplit.dev
  ]).sort((a, b) => a.timestamp - b.timestamp);

  const validationTransactions = flattenEvents([
    ...genuineSplit.validation, ...attackSplit.validation, ...outageSplit.validation, ...flashSaleSplit.validation
  ]).sort((a, b) => a.timestamp - b.timestamp);

  const lockedTestTransactions = flattenEvents([
    ...genuineSplit.lockedTest, ...attackSplit.lockedTest, ...outageSplit.lockedTest, ...flashSaleSplit.lockedTest
  ]).sort((a, b) => a.timestamp - b.timestamp);

  return { devTransactions, validationTransactions, lockedTestTransactions };
}

function printScenarioBreakdown(name, transactions) {
  const counts = {};
  for (const t of transactions) {
    counts[t.scenario] = (counts[t.scenario] || 0) + 1;
  }
  console.log(`${name} (${transactions.length} total):`, counts);
}

const { devTransactions, validationTransactions, lockedTestTransactions } = buildStratifiedDataset();

printScenarioBreakdown('Dev set', devTransactions);
printScenarioBreakdown('Validation set', validationTransactions);
printScenarioBreakdown('Locked test set', lockedTestTransactions);

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

fs.writeFileSync(path.join(dataDir, 'dev.json'), JSON.stringify(devTransactions, null, 2));
fs.writeFileSync(path.join(dataDir, 'validation.json'), JSON.stringify(validationTransactions, null, 2));
fs.writeFileSync(path.join(dataDir, 'locked-test.json'), JSON.stringify(lockedTestTransactions, null, 2));

console.log('Stratified dataset files saved to /data folder.');