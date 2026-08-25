// extract-features.js
// For each transaction, computes behavioral features using THREE separate views
// of recent history: same-IP (for IP-based behavior), same-BIN (for BIN-based
// behavior, catching distributed attacks across many IPs), and overall (general
// merchant-wide behavior). This lets us detect BOTH "one IP testing many cards"
// AND "many IPs targeting the same BIN" — two genuinely different attack shapes.

const WINDOW_MS_5MIN = 5 * 60 * 1000;
const WINDOW_MS_15MIN = 15 * 60 * 1000;

function extractFeatures(transactions) {
  // transactions must already be sorted by timestamp, ascending.
  const results = [];

  for (let i = 0; i < transactions.length; i++) {
    const current = transactions[i];

    // STEP 1: build ONE overall 15-minute window (everyone, no filtering).
    // This is our base — every other view is a filtered slice of this.
    const overallWindow = [];
    for (let j = i - 1; j >= 0; j--) {
      const prev = transactions[j];
      if (current.timestamp - prev.timestamp > WINDOW_MS_15MIN) break; // sorted, safe to stop early
      overallWindow.push(prev);
    }
    const overallWindowAll = overallWindow.concat([current]);

    // STEP 2: SAME-IP view — slice of the overall window, filtered by IP
    const sameIPWindow = overallWindow.filter(t => t.ip === current.ip);
    const sameIPWithin5min = sameIPWindow.filter(t => current.timestamp - t.timestamp <= WINDOW_MS_5MIN);
    const sameIPWithin5minAll = sameIPWithin5min.concat([current]);
    const sameIPWithin15minAll = sameIPWindow.concat([current]);

    const velocity5m = sameIPWithin5minAll.length;
    const velocity15m = sameIPWithin15minAll.length;
    const uniqueCards5m = new Set(sameIPWithin5minAll.map(t => t.card_id)).size;

    // STEP 3: SAME-BIN view — slice of the overall window, filtered by BIN
    // (catches a DISTRIBUTED attack: many different IPs all testing one BIN)
    const sameBinWindow = overallWindow.filter(t => t.bin === current.bin);
    const sameBinWithin15minAll = sameBinWindow.concat([current]);

    const binVelocity15m = sameBinWithin15minAll.length; // how many attempts on this BIN recently
    const uniqueIPsForBin15m = new Set(sameBinWithin15minAll.map(t => t.ip)).size; // how many DIFFERENT sources tried this BIN

    // STEP 4: OVERALL view — general merchant-wide behavior, no IP/BIN filtering
    const declinedCount = overallWindowAll.filter(t => t.status === 'failed').length;
    const declineRate15m = declinedCount / overallWindowAll.length;

    const smallAmountCount = overallWindowAll.filter(t => t.amount < 50).length;
    const smallAmountRatio = smallAmountCount / overallWindowAll.length;

    results.push({
      transaction_id: current.transaction_id,
      features: {
        // IP-based (catches: one IP testing many cards)
        velocity5m,
        velocity15m,
        uniqueCards5m,
        // BIN-based (catches: many IPs targeting the same BIN)
        binVelocity15m,
        uniqueIPsForBin15m,
        // Overall/general behavior
        declineRate15m: Number(declineRate15m.toFixed(3)),
        smallAmountRatio: Number(smallAmountRatio.toFixed(3))
      }
    });
  }

  return results;
}

module.exports = { extractFeatures };