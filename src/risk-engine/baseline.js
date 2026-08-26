// baseline.js
// Computes normal "average" merchant behavior from a set of GENUINE transactions,
// used by the anomaly layer to know what counts as "unusual."

function mean(numbers) {
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

function stdDev(numbers, meanValue) {
  const squaredDiffs = numbers.map(n => (n - meanValue) ** 2);
  const avgSquaredDiff = mean(squaredDiffs);
  return Math.sqrt(avgSquaredDiff);
}

// featureResults: array of { transaction_id, features } from extractFeatures()
// genuineTransactionIds: Set of transaction_ids known to be GENUINE (for baseline-building ONLY)
function computeBaseline(featureResults, genuineTransactionIds) {
  const genuineFeatures = featureResults.filter(r => genuineTransactionIds.has(r.transaction_id));

  const velocities = genuineFeatures.map(r => r.features.velocity5m);
  const declineRates = genuineFeatures.map(r => r.features.declineRate15m);

  const velocityMean = mean(velocities);
  const velocityStdDev = stdDev(velocities, velocityMean);

  const declineMean = mean(declineRates);
  const declineStdDev = stdDev(declineRates, declineMean);

  return {
    velocityMean: Number(velocityMean.toFixed(3)),
    velocityStdDev: Number(velocityStdDev.toFixed(3)),
    declineMean: Number(declineMean.toFixed(3)),
    declineStdDev: Number(declineStdDev.toFixed(3))
  };
}

module.exports = { computeBaseline };