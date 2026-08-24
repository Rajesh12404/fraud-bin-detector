// generator.js
// Generates synthetic payment transaction events for our fraud detector.

// A few realistic bank BIN prefixes (first 8 digits of a card number)
const BINS = ['41111111', '42424242', '55224455', '40012345', '51051012', '45320198', '60111144'];

const COUNTRIES = ['IN', 'US', 'UK', 'SG'];

// Simple random number helper — returns integer between min and max (inclusive)
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Picks a random item from an array
function randomChoice(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

// Generates a fake IP address (not a real one, just realistic-looking)
function randomIP() {
  return `${randomInt(1, 255)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 255)}`;
}

// Generates a fake tokenized card ID — NEVER a real card number, just a random identifier
function randomCardId() {
  return 'card_' + Math.random().toString(36).substring(2, 12);
}

function randomDeviceId() {
  return 'device_' + Math.random().toString(36).substring(2, 10);
}

let transactionCounter = 1;
function nextTransactionId() {
  return 'txn_' + String(transactionCounter++).padStart(6, '0');
}

// Generates ONE genuine, normal customer transaction
function generateGenuineTransaction(timestamp) {
  const isSuccess = Math.random() > 0.1; // 90% of genuine transactions succeed
  return {
    transaction_id: nextTransactionId(),
    timestamp: timestamp,
    amount: randomInt(100, 5000), // realistic purchase amounts, in rupees
    currency: 'INR',
    status: isSuccess ? 'success' : 'failed',
    bin: randomChoice(BINS),
    card_id: randomCardId(),
    ip: randomIP(),
    device_id: randomDeviceId(),
    merchant_id: 'merchant_001',
    failure_reason: isSuccess ? null : randomChoice(['insufficient_balance', 'wrong_cvv', 'network_timeout']),
    country: randomChoice(COUNTRIES),
    label: 'GENUINE', // this is our ground-truth tag, used later to measure accuracy
scenario: 'GENUINE' // which scenario generated this — for evaluation only
  };
}
// Generates a BURST of attack transactions — simulates a card-testing / BIN attack
// Unlike genuine transactions (one customer, one card), an attack is many transactions
// sharing the same IP/device but using many DIFFERENT stolen/generated card numbers,
// all within a very short time window, with a high decline rate.
function generateAttackBurst(startTimestamp) {
  const attackerIP = randomIP();       // ONE ip for the whole attack
  const attackerDeviceId = randomDeviceId(); // ONE device for the whole attack
  const attackBin = randomChoice(BINS);      // attackers often target ONE bank's BIN range

  const burstSize = randomInt(20, 80); // how many card attempts in this attack
  const transactions = [];

  for (let i = 0; i < burstSize; i++) {
    // attempts happen fast — a few hundred milliseconds to a couple seconds apart
    const timestamp = startTimestamp + i * randomInt(200, 2000);

    // attackers succeed very rarely — that's the whole point of testing, most guesses are wrong
    const isSuccess = Math.random() > 0.95; // only ~5% succeed

    transactions.push({
      transaction_id: nextTransactionId(),
      timestamp: timestamp,
      amount: randomInt(1, 50), // attackers use TINY amounts to avoid detection/limits
      currency: 'INR',
      status: isSuccess ? 'success' : 'failed',
      bin: attackBin, // same BIN range attempted repeatedly
      card_id: randomCardId(), // DIFFERENT fake card every time
      ip: attackerIP, // SAME ip every time
      device_id: attackerDeviceId, // SAME device every time
      merchant_id: 'merchant_001',
      failure_reason: isSuccess ? null : 'card_declined',
      country: randomChoice(COUNTRIES),
      label: 'ATTACK', // ground-truth tag
scenario: 'CARD_TESTING' // which scenario generated this — for evaluation only
    });
  }

  return transactions;
}
// Generates a burst of GENUINE failures that LOOK suspicious at first glance
// (high volume, many declines) but are NOT a card-testing attack — e.g. a bank
// outage causing many real customers' payments to fail around the same time.
// This is critical: it tests that our detector doesn't just think "high volume = fraud."
function generateBankOutageBurst(startTimestamp) {
  const burstSize = randomInt(50, 150); // a real outage affects MANY customers
  const transactions = [];

  for (let i = 0; i < burstSize; i++) {
    // spread over a few minutes, not seconds — real customers aren't perfectly synced
    const timestamp = startTimestamp + i * randomInt(1000, 8000);

    transactions.push({
      transaction_id: nextTransactionId(),
      timestamp: timestamp,
      amount: randomInt(100, 5000), // NORMAL purchase amounts — not tiny like an attack
      currency: 'INR',
      status: 'failed', // outage means the payment attempt fails
      bin: randomChoice(BINS),
      card_id: randomCardId(), // each customer has their OWN card (different every time, like genuine)
      ip: randomIP(),          // DIFFERENT ip per customer — no concentration
      device_id: randomDeviceId(), // DIFFERENT device per customer
      merchant_id: 'merchant_001',
      failure_reason: 'network_timeout', // the outage-specific reason
      country: randomChoice(COUNTRIES),
      label: 'GENUINE', // ground truth: this is NOT an attack, even though volume is high
scenario: 'BANK_OUTAGE' // which scenario generated this — for evaluation only
    });
  }

  return transactions;
}

// Generates a burst of GENUINE successful purchases during a flash sale —
// high volume and fast pace, but normal decline rate and no card/IP concentration.
function generateFlashSaleBurst(startTimestamp) {
  const burstSize = randomInt(50, 150);
  const transactions = [];

  for (let i = 0; i < burstSize; i++) {
    const timestamp = startTimestamp + i * randomInt(500, 3000); // fast, real shopping rush

    const isSuccess = Math.random() > 0.15; // slightly higher decline rate than normal (busy servers), still mostly succeeding

    transactions.push({
      transaction_id: nextTransactionId(),
      timestamp: timestamp,
      amount: randomInt(100, 5000), // normal purchase amounts
      currency: 'INR',
      status: isSuccess ? 'success' : 'failed',
      bin: randomChoice(BINS),
      card_id: randomCardId(), // different customer, different card every time
      ip: randomIP(),          // different customer, different IP
      device_id: randomDeviceId(),
      merchant_id: 'merchant_001',
      failure_reason: isSuccess ? null : randomChoice(['insufficient_balance', 'network_timeout']),
      country: randomChoice(COUNTRIES),
      label: 'GENUINE', // ground truth: NOT an attack, just a busy sale
scenario: 'FLASH_SALE' // which scenario generated this — for evaluation only
    });
  }

  return transactions;
}
module.exports = { generateGenuineTransaction, generateAttackBurst, generateBankOutageBurst, generateFlashSaleBurst, randomInt, randomChoice, randomIP, randomCardId, randomDeviceId, nextTransactionId };