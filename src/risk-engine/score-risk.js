// score-risk.js
// Takes the features computed for a transaction and produces a 0-100 risk score,
// using two independent components: explicit RULES (auditable thresholds) and
// STATISTICAL ANOMALY scoring (how unusual this looks vs normal baseline behavior).
// This file NEVER looks at label or scenario — only the computed features.

// ---------- RULES LAYER ----------
// Each rule checks one specific pattern and contributes points if triggered.
// Explicit and auditable: we can always say exactly WHY a rule fired.
function computeRuleScore(features) {
  let score = 0;
  const firedRules = [];

  if (features.velocity5m >= 6) {
    score += 25;
    firedRules.push('HIGH_VELOCITY_5MIN');
  }

  if (features.uniqueCards5m >= 5) {
    score += 25;
    firedRules.push('HIGH_CARD_DIVERSITY');
  }

  if (features.uniqueIPsForBin15m >= 8) {
    score += 25;
    firedRules.push('DISTRIBUTED_BIN_ATTACK');
  }

  if (features.declineRate15m >= 0.7) {
    score += 15;
    firedRules.push('HIGH_DECLINE_RATE');
  }

  if (features.smallAmountRatio >= 0.7) {
    score += 10;
    firedRules.push('SMALL_AMOUNT_PATTERN');
  }

  return { score: Math.min(score, 100), firedRules };
}
// ---------- ANOMALY LAYER ----------
// Instead of a fixed threshold, this asks: "is this velocity unusually high
// COMPARED TO this merchant's own normal baseline?" — using a z-score.
// A z-score tells you how many standard deviations away from the average
// a value is. z=0 means exactly average. z=3+ is a rare, unusual spike.
function computeZScore(value, mean, stdDev) {
  const safeStdDev = Math.max(stdDev, 0.5); // never let variation be treated as less than 0.5
  return (value - mean) / safeStdDev;
}

// Converts a z-score into a 0-100 anomaly score.
// We treat z=0 as 0 points, and z=5 or higher as the max 100 points.
function anomalyScoreFromZ(z) {
  const clamped = Math.max(0, Math.min(z, 5)); // clamp between 0 and 5
  return (clamped / 5) * 100;
}

function computeAnomalyScore(features, baseline) {
  const velocityZ = computeZScore(features.velocity5m, baseline.velocityMean, baseline.velocityStdDev);
  const declineZ = computeZScore(features.declineRate15m, baseline.declineMean, baseline.declineStdDev);

  const velocityAnomaly = anomalyScoreFromZ(velocityZ);
  const declineAnomaly = anomalyScoreFromZ(declineZ);

  // Combine the two anomaly signals — take the average
  const combinedAnomaly = (velocityAnomaly + declineAnomaly) / 2;

  return {
    score: Math.round(combinedAnomaly),
    velocityZScore: Number(velocityZ.toFixed(2)),
    declineZScore: Number(declineZ.toFixed(2))
  };
}

// ---------- COMBINE ----------
// Final score is a weighted blend: rules matter more since they're explainable,
// anomaly acts as a supporting signal.
function computeRiskScore(features, baseline) {
  const rules = computeRuleScore(features);
  const anomaly = computeAnomalyScore(features, baseline);

  const finalScore = Math.round(rules.score * 0.7 + anomaly.score * 0.3);

  let classification;
  if (finalScore >= 70) classification = 'HIGH';
  else if (finalScore >= 35) classification = 'MEDIUM';
  else classification = 'LOW';

  return {
    riskScore: finalScore,
    classification,
    firedRules: rules.firedRules,
    ruleScore: rules.score,
    anomalyScore: anomaly.score,
    velocityZScore: anomaly.velocityZScore,
    declineZScore: anomaly.declineZScore
  };
}

module.exports = { computeRiskScore, computeRuleScore, computeAnomalyScore };