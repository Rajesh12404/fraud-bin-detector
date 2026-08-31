import { useState } from 'react';
import './Simulator.css';

const API_BASE = 'http://localhost:4000/api';

const initialForm = {
  amount: '47',
  ip: '43.169.132.19',
  card_id: 'test-card-001',
  bin: '411111',
  status: 'failed'
};

function Simulator() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanStep, setScanStep] = useState(0);

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const runAnalysis = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    setScanStep(1);

    const timer1 = setTimeout(() => setScanStep(2), 650);
    const timer2 = setTimeout(() => setScanStep(3), 1300);
    const timer3 = setTimeout(() => setScanStep(4), 1950);

    try {
      const response = await fetch(`${API_BASE}/simulate-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(form.amount),
          ip: form.ip.trim(),
          card_id: form.card_id.trim(),
          bin: form.bin.trim(),
          status: form.status
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Transaction analysis failed');
      }

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setScanStep(5);
      setResult(data);
    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetSimulation = () => {
    setForm(initialForm);
    setResult(null);
    setError('');
    setScanStep(0);
  };

  const risk = result?.riskResult;
  const features = result?.features;
  const decision = result?.finalDecision;
  const ai = result?.aiResult;

  const riskClass = risk?.classification?.toLowerCase() || '';
  const decisionClass = decision?.finalAction?.toLowerCase() || '';

  const pipeline = [
    { number: '01', icon: '⌁', title: 'Transaction', text: 'Input received', done: scanStep >= 1 },
    { number: '02', icon: '◈', title: 'Feature Engine', text: 'Behavioral signals', done: scanStep >= 2 },
    { number: '03', icon: '◎', title: 'Risk Engine', text: 'Deterministic score', done: scanStep >= 3 },
    { number: '04', icon: '✦', title: 'Gemini AI', text: 'Risk explanation', done: scanStep >= 4 },
    { number: '05', icon: '✓', title: 'Policy Gate', text: 'Final authority', done: scanStep >= 5 }
  ];

  return (
    <div className="simulator-page">
      <div className="sim-orb sim-orb-one" />
      <div className="sim-orb sim-orb-two" />
      <div className="sim-grid" />
      <div className="sim-noise" />

      <header className="sim-topbar">
        <a className="sim-brand" href="/">
          <span className="brand-shield">◆</span>
          <span>
            <strong>RISKSHIELD</strong>
            <small>PAYMENT RISK INTELLIGENCE</small>
          </span>
        </a>

        <div className="topbar-right">
          <span className="environment-pill">
            <i />
            TEST ENVIRONMENT
          </span>
          <a className="back-link" href="/">← Dashboard</a>
        </div>
      </header>

      <main className="sim-main">
        <section className="sim-hero">
          <div className="hero-copy">
            <div className="sim-eyebrow">
              <span className="eyebrow-line" />
              LIVE DETECTION ENVIRONMENT
            </div>

            <h1>
              Transaction
              <span> Simulator</span>
            </h1>

            <p>
              Send a controlled transaction through the same RiskShield
              detection pipeline used by the application in real time.
            </p>

            <div className="hero-meta">
              <span><b>●</b> ENGINE ONLINE</span>
              <span>DETERMINISTIC RISK + AI EXPLANATION</span>
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="radar">
              <div className="radar-ring ring-1" />
              <div className="radar-ring ring-2" />
              <div className="radar-ring ring-3" />
              <div className="radar-sweep" />
              <span className="radar-dot dot-a" />
              <span className="radar-dot dot-b" />
              <span className="radar-dot dot-c" />
              <div className="radar-core">RS</div>
            </div>
          </div>
        </section>

        <section className="sim-workspace">
          <div className="sim-card input-card">
            <div className="card-header">
              <div>
                <span className="section-kicker">01 / INPUT</span>
                <h2>Transaction Details</h2>
                <p>Use synthetic identifiers for safe testing.</p>
              </div>
              <span className="test-badge"><i /> TEST MODE</span>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Amount</span>
                <div className="input-shell amount-shell">
                  <b>₹</b>
                  <input
                    type="number"
                    min="1"
                    value={form.amount}
                    onChange={(e) => update('amount', e.target.value)}
                  />
                </div>
              </label>

              <label className="field">
                <span>IP Address</span>
                <input
                  value={form.ip}
                  onChange={(e) => update('ip', e.target.value)}
                  placeholder="43.169.132.19"
                />
              </label>

              <label className="field">
                <span>Test Card ID</span>
                <input
                  value={form.card_id}
                  onChange={(e) => update('card_id', e.target.value)}
                  placeholder="test-card-001"
                />
              </label>

              <label className="field">
                <span>BIN</span>
                <input
                  value={form.bin}
                  maxLength={8}
                  onChange={(e) => update('bin', e.target.value)}
                  placeholder="411111"
                />
              </label>

              <label className="field field-wide">
                <span>Payment Status</span>
                <select
                  value={form.status}
                  onChange={(e) => update('status', e.target.value)}
                >
                  <option value="failed">Failed</option>
                  <option value="success">Success</option>
                </select>
              </label>
            </div>

            <div className="safe-notice">
              <span>ⓘ</span>
              <div>
                <strong>Simulation only</strong>
                <small>Never enter a real card number, CVV, PIN, OTP, or payment credential.</small>
              </div>
            </div>

            <button
              className={`analysis-button ${loading ? 'is-loading' : ''}`}
              onClick={runAnalysis}
              disabled={loading}
            >
              <span className="button-glow" />
              {loading ? (
                <>
                  <span className="button-spinner" />
                  ANALYZING TRANSACTION...
                </>
              ) : (
                <>
                  <span className="button-icon">⚡</span>
                  RUN FULL ANALYSIS
                  <span className="button-arrow">→</span>
                </>
              )}
            </button>

            {result && !loading && (
              <button className="reset-button" onClick={resetSimulation}>
                ↻ Run another simulation
              </button>
            )}
          </div>

          <div className="sim-card pipeline-card">
            <div className="card-header pipeline-header">
              <div>
                <span className="section-kicker">02 / PIPELINE</span>
                <h2>Detection Chain</h2>
                <p>Every stage is executed in sequence.</p>
              </div>
              <span className={`pipeline-status ${loading ? 'scanning' : result ? 'complete' : ''}`}>
                <i />
                {loading ? 'SCANNING' : result ? 'COMPLETE' : 'STANDBY'}
              </span>
            </div>

            <div className="pipeline">
              {pipeline.map((node, index) => (
                <div className="pipeline-wrap" key={node.number}>
                  <div className={`pipeline-node ${node.done ? 'done' : ''} ${loading && scanStep === index + 1 ? 'current' : ''} ${index === 3 ? 'ai-node' : ''}`}>
                    <div className="pipeline-icon">
                      {node.done ? '✓' : node.icon}
                    </div>
                    <div className="pipeline-info">
                      <span>{node.number}</span>
                      <strong>{node.title}</strong>
                      <small>{node.text}</small>
                    </div>
                    <div className="pipeline-check">{node.done ? '✓' : '·'}</div>
                  </div>
                  {index < pipeline.length - 1 && (
                    <div className={`pipeline-connector ${node.done ? 'done' : ''}`}>
                      <span />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {loading && (
          <section className="scan-panel">
            <div className="scan-top">
              <div>
                <span className="section-kicker">LIVE PROCESSING</span>
                <strong>Analyzing transaction telemetry</strong>
              </div>
              <span className="scan-counter">0{Math.min(scanStep, 5)} / 05</span>
            </div>

            <div className="scan-track">
              <div className="scan-fill" style={{ width: `${Math.min(scanStep, 5) * 20}%` }} />
              <div className="scan-beam" />
            </div>

            <div className="scan-labels">
              {['RECEIVED', 'FEATURES', 'RISK SCORE', 'AI ANALYSIS', 'POLICY'].map((item, i) => (
                <span className={scanStep >= i + 1 ? 'active' : ''} key={item}>
                  <i /> {item}
                </span>
              ))}
            </div>
          </section>
        )}

        {error && (
          <section className="error-panel">
            <div className="error-icon">!</div>
            <div>
              <strong>ANALYSIS FAILED</strong>
              <span>{error}</span>
            </div>
          </section>
        )}

        {result && (
          <section className="result-section">
            <div className="result-heading">
              <div>
                <span className="section-kicker">03 / ANALYSIS COMPLETE</span>
                <h2>Transaction Verdict</h2>
                <p>Full evidence chain returned by the detection engine.</p>
              </div>
              <div className="result-id">
                <span>EVENT ID</span>
                <strong>{result.transaction.transaction_id}</strong>
              </div>
            </div>

            <div className="result-top-grid">
              <div className={`score-card ${riskClass}`}>
                <div className="score-card-top">
                  <span>RISK SCORE</span>
                  <span className="score-live"><i /> LIVE RESULT</span>
                </div>

                <div className="score-gauge" style={{ '--score': `${risk.riskScore * 3.6}deg` }}>
                  <div className="gauge-inner">
                    <strong>{risk.riskScore}</strong>
                    <span>/100</span>
                  </div>
                </div>

                <div className="score-label">{risk.classification} RISK</div>
                <div className="score-meter">
                  <span style={{ width: `${risk.riskScore}%` }} />
                </div>
              </div>

              <div className="evidence-card">
                <div className="result-label">BEHAVIORAL EVIDENCE</div>
                <div className="evidence-grid">
                  <div><span>Velocity 5m</span><strong>{features.velocity5m}</strong></div>
                  <div><span>Velocity 15m</span><strong>{features.velocity15m}</strong></div>
                  <div><span>Unique Cards</span><strong>{features.uniqueCards5m}</strong></div>
                  <div><span>BIN Velocity</span><strong>{features.binVelocity15m}</strong></div>
                  <div><span>Unique BIN IPs</span><strong>{features.uniqueIPsForBin15m}</strong></div>
                  <div><span>Decline Rate</span><strong>{Math.round(features.declineRate15m * 100)}%</strong></div>
                  <div><span>Small Amount Ratio</span><strong>{Math.round(features.smallAmountRatio * 100)}%</strong></div>
                </div>
              </div>

              <div className={`verdict-card ${decisionClass}`}>
                <span className="result-label">FINAL POLICY DECISION</span>
                <div className="verdict-icon">
                  {decisionClass.includes('block') || decisionClass.includes('reject') ? '!' : '✓'}
                </div>
                <strong>{decision.finalAction.replaceAll('_', ' ')}</strong>
                <span>Policy Gate authority</span>
                {decision.overrideReason && <p>{decision.overrideReason}</p>}
              </div>
            </div>

            <div className="ai-card">
              <div className="ai-header">
                <div className="ai-title">
                  <span className="ai-spark">✦</span>
                  <div>
                    <span className="result-label">AI INTERPRETATION</span>
                    <strong>Gemini Risk Analysis</strong>
                  </div>
                </div>
                <span className="ai-badge">GEMINI</span>
              </div>

              {ai ? (
                <>
                  <div className="ai-explanation">{ai.explanation}</div>
                  <div className="ai-meta">
                    <div>
                      <span>AI CLASSIFICATION</span>
                      <strong>{ai.classification}</strong>
                    </div>
                    <div>
                      <span>AI RECOMMENDATION</span>
                      <strong>{ai.recommended_action}</strong>
                    </div>
                  </div>
                </>
              ) : (
                <div className="ai-explanation">No AI explanation returned.</div>
              )}
            </div>

            <div className="final-chain">
              <div className="final-chain-title">
                <span className="section-kicker">DECISION FLOW</span>
                <span>Evidence → Score → Explain → Decide</span>
              </div>
              <div className="chain-visual">
                {['FEATURE ENGINE', 'RISK ENGINE', 'GEMINI AI', 'POLICY GATE'].map((item, i) => (
                  <div className="chain-item" key={item}>
                    <span>0{i + 1}</span>
                    <strong>{item}</strong>
                    {i < 3 && <b>→</b>}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="sim-footer">
        <span>RISKSHIELD / LIVE SIMULATION CONSOLE</span>
        <span>LOCAL ENGINE • TEST DATA ONLY</span>
      </footer>
    </div>
  );
}

export default Simulator;
