// policy-gate.js
// Takes the risk engine's score/classification AND Gemini's recommendation,
// and applies HARD, deterministic safety rules to decide the FINAL action.
// This is the actual authority in the system — not the LLM.

function applyPolicyGate(riskResult, aiRecommendation) {
  const { riskScore, classification } = riskResult;
  const { recommended_action, classification: aiClassification, explanation } = aiRecommendation;

  let finalAction;
  let overrideReason = null;

  // HARD RULE 1: never block recovery unless the risk engine itself says HIGH.
  // Even if Gemini suggests BLOCK_RECOVERY, we don't trust that alone —
  // the deterministic score must independently support it.
  if (recommended_action === 'BLOCK_RECOVERY' && classification !== 'HIGH') {
    finalAction = 'MONITOR';
    overrideReason = 'AI recommended blocking, but risk engine score did not reach HIGH — downgraded to MONITOR as a safety measure';
  }
  // HARD RULE 2: if the risk engine says HIGH, we always block, regardless of
  // what the AI says — the deterministic score is the ultimate authority for HIGH cases.
  else if (classification === 'HIGH') {
    finalAction = 'BLOCK_RECOVERY';
  }
  // HARD RULE 3: if the risk engine says LOW, we always allow recovery,
  // regardless of what the AI says — protects genuine customers even if the
  // AI's language model makes an unusual suggestion.
  else if (classification === 'LOW') {
    finalAction = 'ALLOW_RECOVERY';
    if (recommended_action !== 'ALLOW_RECOVERY') {
      overrideReason = `AI recommended ${recommended_action}, but risk engine score was LOW — overridden to ALLOW_RECOVERY to protect the customer`;
    }
  }
  // MEDIUM classification: trust the AI's recommendation, since this is
  // exactly the ambiguous zone where a nuanced read genuinely helps —
  // but never allow MEDIUM to escalate to a full block on AI's word alone.
  else {
    finalAction = recommended_action === 'BLOCK_RECOVERY' ? 'MONITOR' : recommended_action;
  }

  return {
    finalAction,
    riskScore,
    riskClassification: classification,
    aiRecommendation: recommended_action,
    aiClassification,
    aiExplanation: explanation,
    overrideReason
  };
}

module.exports = { applyPolicyGate };