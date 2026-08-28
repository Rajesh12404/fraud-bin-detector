import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

import './App.css';

const API_BASE = 'http://localhost:4000/api';

function App() {
  const [overview, setOverview] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    fetch(`${API_BASE}/overview`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load overview');
        return res.json();
      })
      .then((data) => setOverview(data))
      .catch((err) => console.error(err));

    fetch(`${API_BASE}/evaluation`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load evaluation');
        return res.json();
      })
      .then((data) => setEvaluation(data))
      .catch((err) => console.error(err));
  }, []);

  async function handleTransactionClick(txnId) {
    setSelectedTxn(txnId);
    setDetail(null);
    setLoadingDetail(true);

    try {
      const res = await fetch(`${API_BASE}/transaction/${txnId}`);

      if (!res.ok) {
        throw new Error('Failed to load transaction');
      }

      const data = await res.json();
      setDetail(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeModal() {
    setSelectedTxn(null);
    setDetail(null);
  }

  const filteredTransactions = useMemo(() => {
    if (!overview) return [];

    return overview.transactions.filter((txn) => {
      const matchesFilter =
        filter === 'ALL' || txn.classification === filter;

      const query = search.toLowerCase();

      const matchesSearch =
        !query ||
        txn.transaction_id.toLowerCase().includes(query) ||
        txn.ip.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [overview, search, filter]);

  const chartData = useMemo(() => {
    if (!overview) return [];

    return overview.transactions
      .slice(0, 150)
      .map((txn, index) => ({
        index: index + 1,
        score: txn.riskScore
      }));
  }, [overview]);

  const riskDistribution = useMemo(() => {
    if (!overview) return [];

    return [
      {
        label: 'HIGH',
        count: overview.highRiskCount,
        className: 'HIGH'
      },
      {
        label: 'MEDIUM',
        count: overview.mediumRiskCount,
        className: 'MEDIUM'
      },
      {
        label: 'LOW',
        count:
          overview.totalTransactions -
          overview.highRiskCount -
          overview.mediumRiskCount,
        className: 'LOW'
      }
    ];
  }, [overview]);

  if (!overview) {
    return (
      <div className="loading-screen">
        <div>
          <strong>RISKSHIELD</strong>
          <p>Initializing risk intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* =====================================================
          HEADER
          ===================================================== */}

      <header className="header">
        <div className="header-top">
          <div>
            <h1>
              <span>🛡️</span>
              RISKSHIELD
            </h1>

            <p>Real-Time Payment Risk Intelligence Center</p>
          </div>

          <div className="snapshot-badge">
            <span className="snapshot-dot" />
            SYSTEM OPERATIONAL
          </div>
        </div>
      </header>

      {/* =====================================================
          KPI CARDS
          ===================================================== */}

      <section className="stats-grid">
        <div className="stat-card">
          <div className="label">Transactions</div>
          <div className="value">
            {overview.totalTransactions.toLocaleString()}
          </div>
        </div>

        <div className="stat-card">
          <div className="label">Failed Payments</div>
          <div className="value">
            {overview.failedTransactions.toLocaleString()}
          </div>
        </div>

        <div className="stat-card high">
          <div className="label">High Risk</div>
          <div className="value">
            {overview.highRiskCount.toLocaleString()}
          </div>
        </div>

        <div className="stat-card medium">
          <div className="label">Medium Risk</div>
          <div className="value">
            {overview.mediumRiskCount.toLocaleString()}
          </div>
        </div>
      </section>

      {/* =====================================================
          ANALYTICS
          ===================================================== */}

      <section className="grid-2col">
        <div className="panel">
          <h2>Risk Activity</h2>

          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient
                  id="riskGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="#6366f1"
                    stopOpacity={0.32}
                  />

                  <stop
                    offset="100%"
                    stopColor="#6366f1"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 5"
                stroke="#252b3a"
              />

              <XAxis
                dataKey="index"
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={{ stroke: '#303749' }}
                tickLine={false}
              />

              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={{ stroke: '#303749' }}
                tickLine={false}
              />

              <Tooltip
                contentStyle={{
                  background: '#10141d',
                  border: '1px solid #303749',
                  borderRadius: '10px',
                  color: '#e2e8f0'
                }}
                labelStyle={{
                  color: '#94a3b8'
                }}
                formatter={(value) => [
                  `${value}/100`,
                  'Risk Score'
                ]}
              />

              <Area
                type="monotone"
                dataKey="score"
                stroke="#818cf8"
                strokeWidth={2.2}
                fill="url(#riskGradient)"
                dot={false}
                activeDot={{
                  r: 5,
                  strokeWidth: 2,
                  fill: '#111522'
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <h2>Risk Distribution</h2>

          <div className="severity-bars">
            {riskDistribution.map((item) => {
              const percentage =
                overview.totalTransactions > 0
                  ? (item.count / overview.totalTransactions) * 100
                  : 0;

              return (
                <div className="severity-row" key={item.label}>
                  <span className="sev-label">{item.label}</span>

                  <div className="sev-track">
                    <div
                      className={`sev-fill ${item.className}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <span className="sev-count">
                    {item.count.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 34,
              paddingTop: 20,
              borderTop: '1px solid #202535',
              color: '#64748b',
              fontSize: 12,
              lineHeight: 1.6
            }}
          >
            Deterministic risk scoring is performed locally.
            Gemini is used only for evidence interpretation.
          </div>
        </div>
      </section>

      {/* =====================================================
          MODEL PERFORMANCE
          ===================================================== */}

      <section
        className="evaluation-panel"
        style={{
          marginTop: 24,
          padding: 24,
          border: '1px solid #20283a',
          borderRadius: 16,
          background:
            'radial-gradient(circle at 85% 0%, rgba(99,102,241,0.08), transparent 35%), #0f131d'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 20,
            flexWrap: 'wrap',
            marginBottom: 20
          }}
        >
          <div>
            <div
              style={{
                color: '#71809d',
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.14em',
                marginBottom: 7
              }}
            >
              MODEL VALIDATION
            </div>

            <h2 style={{ margin: 0 }}>Detection Performance</h2>

            <p
              style={{
                margin: '7px 0 0',
                color: '#64748b',
                fontSize: 12
              }}
            >
              Deterministic risk engine evaluated against the locked test set.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 12px',
              border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 999,
              color: '#73dca0',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.08em'
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 10px rgba(34,197,94,0.8)'
              }}
            />
            VERIFIED TEST SET
          </div>
        </div>

        {evaluation ? (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 12
              }}
            >
              {[
                {
                  label: 'PRECISION',
                  value: `${(evaluation.precision * 100).toFixed(1)}%`,
                  description: 'Fraud predictions that were correct'
                },
                {
                  label: 'RECALL',
                  value: `${(evaluation.recall * 100).toFixed(1)}%`,
                  description: 'Fraud cases successfully detected'
                },
                {
                  label: 'ACCURACY',
                  value: `${(evaluation.accuracy * 100).toFixed(1)}%`,
                  description: 'Overall classification accuracy'
                },
                {
                  label: 'TESTED',
                  value: evaluation.total.toLocaleString(),
                  description: 'Locked transactions evaluated'
                }
              ].map((metric) => (
                <div
                  key={metric.label}
                  style={{
                    padding: 18,
                    border: '1px solid #20283a',
                    borderRadius: 12,
                    background: '#0a0e15'
                  }}
                >
                  <div
                    style={{
                      color: '#71809d',
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.08em'
                    }}
                  >
                    {metric.label}
                  </div>

                  <div
                    style={{
                      margin: '8px 0 5px',
                      color: '#e2e8f0',
                      fontSize: 27,
                      fontWeight: 800,
                      lineHeight: 1
                    }}
                  >
                    {metric.value}
                  </div>

                  <div style={{ color: '#596782', fontSize: 10 }}>
                    {metric.description}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 12,
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 12
              }}
            >
              {[
                {
                  label: 'TRUE POSITIVE',
                  value: evaluation.confusionMatrix.truePositive,
                  description: 'Fraud correctly detected',
                  valueColor: '#42d985'
                },
                {
                  label: 'FALSE POSITIVE',
                  value: evaluation.confusionMatrix.falsePositive,
                  description: 'Genuine incorrectly blocked',
                  valueColor: '#ff6f78'
                },
                {
                  label: 'TRUE NEGATIVE',
                  value: evaluation.confusionMatrix.trueNegative,
                  description: 'Genuine correctly passed',
                  valueColor: '#63a9ff'
                },
                {
                  label: 'FALSE NEGATIVE',
                  value: evaluation.confusionMatrix.falseNegative,
                  description: 'Fraud not detected',
                  valueColor: '#ffbd3d'
                }
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: 18,
                    border: '1px solid #20283a',
                    borderRadius: 12,
                    background: '#0a0e15'
                  }}
                >
                  <div
                    style={{
                      color: '#71809d',
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.07em'
                    }}
                  >
                    {item.label}
                  </div>

                  <div
                    style={{
                      margin: '8px 0 5px',
                      color: item.valueColor,
                      fontSize: 23,
                      fontWeight: 800
                    }}
                  >
                    {item.value.toLocaleString()}
                  </div>

                  <div style={{ color: '#596782', fontSize: 10 }}>
                    {item.description}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTop: '1px solid #202535',
                color: '#596782',
                fontSize: 11,
                lineHeight: 1.6
              }}
            >
              <strong style={{ color: '#8997b2' }}>Evaluation note:</strong>{' '}
              Precision and recall are measured against the locked test set.
              Gemini is not used to calculate these metrics; the deterministic
              risk engine produces the predictions.
            </div>
          </>
        ) : (
          <div style={{ color: '#64748b', fontSize: 12 }}>
            Loading model evaluation...
          </div>
        )}
      </section>

      {/* =====================================================
          TRANSACTION INVESTIGATION
          ===================================================== */}

      <section className="transaction-list">
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid #232838',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 15,
            flexWrap: 'wrap'
          }}
        >
          <div>
            <h2 style={{ padding: 0, border: 0 }}>
              Transaction Investigation
            </h2>

            <div
              style={{
                marginTop: 5,
                color: '#64748b',
                fontSize: 11
              }}
            >
              Select an event to inspect the complete risk decision chain.
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap'
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transaction / IP"
              style={{
                background: '#0b0e14',
                border: '1px solid #293043',
                borderRadius: 8,
                padding: '8px 11px',
                color: '#e2e8f0',
                outline: 'none',
                fontSize: 11,
                width: 180
              }}
            />

            {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                style={{
                  border: '1px solid #293043',
                  background:
                    filter === item
                      ? '#202638'
                      : '#0b0e14',
                  color:
                    filter === item
                      ? '#c7d2fe'
                      : '#64748b',
                  borderRadius: 8,
                  padding: '8px 11px',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 700
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="txn-scroll">
          {filteredTransactions.map((txn) => (
            <div
              key={txn.transaction_id}
              className="transaction-row"
              onClick={() =>
                handleTransactionClick(txn.transaction_id)
              }
            >
              <span className="mono">
                {txn.transaction_id}
              </span>

              <span>
                ₹{Number(txn.amount).toLocaleString()}
              </span>

              <span className="mono">
                {txn.ip}
              </span>

              <span>
                <span className={`badge ${txn.classification}`}>
                  {txn.classification}
                </span>
              </span>

              <span>
                {txn.riskScore}/100
              </span>
            </div>
          ))}

          {filteredTransactions.length === 0 && (
            <div
              style={{
                padding: 35,
                textAlign: 'center',
                color: '#64748b',
                fontSize: 13
              }}
            >
              No transactions match your search.
            </div>
          )}
        </div>
      </section>

      {/* =====================================================
          INCIDENT MODAL
          ===================================================== */}

      {selectedTxn && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="modal">
            <div className="modal-top">
              <div>
                <div
                  style={{
                    color: '#64748b',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    marginBottom: 6
                  }}
                >
                  Incident Investigation
                </div>

                <h2>{selectedTxn}</h2>
              </div>

              <button
                className="close-btn"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            {loadingDetail && (
              <div style={{ paddingTop: 25 }}>
                <div className="skeleton skeleton-block" />
                <div className="skeleton skeleton-line" />
                <div className="skeleton skeleton-line" />
                <div className="skeleton skeleton-block" />
                <div className="skeleton skeleton-block" />
              </div>
            )}

            {detail && !loadingDetail && (
              <>
                {/* FINAL DECISION */}

              {/* =====================================================
    INCIDENT INTELLIGENCE
    ===================================================== */}

{/* TRANSACTION CONTEXT */}
<div className="incident-context">
  <div className="context-item">
    <span>TRANSACTION</span>
    <strong>{selectedTxn}</strong>
  </div>

  <div className="context-item">
    <span>AMOUNT</span>
    <strong>
      ₹{Number(
        overview.transactions.find(
          (t) => t.transaction_id === selectedTxn
        )?.amount || 0
      ).toLocaleString()}
    </strong>
  </div>

  <div className="context-item">
    <span>IP ADDRESS</span>
    <strong className="mono">
      {overview.transactions.find(
        (t) => t.transaction_id === selectedTxn
      )?.ip || '—'}
    </strong>
  </div>

  <div className="context-item">
    <span>STATUS</span>
    <strong>
      {overview.transactions.find(
        (t) => t.transaction_id === selectedTxn
      )?.scenario === 'CARD_TESTING'
        ? 'SUSPICIOUS ACTIVITY'
        : 'NORMAL ACTIVITY'}
    </strong>
  </div>
</div>

{/* FINAL DECISION */}
<div className="detail-section">
  <div className="section-kicker">FINAL POLICY DECISION</div>

  <div
    className={`decision-banner ${detail.finalDecision.finalAction}`}
  >
    <span className="decision-dot" />
    {detail.finalDecision.finalAction.replaceAll('_', ' ')}
  </div>

  <div className="decision-authority">
    <div>
      <span className="authority-label">DECISION AUTHORITY</span>
      <strong>Deterministic Policy Gate</strong>
    </div>

    <div className="authority-flow">
      <span>RISK ENGINE</span>
      <span>→</span>
      <span>GEMINI</span>
      <span>→</span>
      <span>POLICY GATE</span>
    </div>
  </div>
</div>

{/* RISK ASSESSMENT */}
<div className="detail-section">
  <div className="section-kicker">RISK ASSESSMENT</div>

  <div className="risk-assessment-card">
    <div
      className="gauge"
      style={{
        background: `conic-gradient(
          ${
            detail.riskResult.classification === 'HIGH'
              ? '#ef4444'
              : detail.riskResult.classification === 'MEDIUM'
              ? '#f59e0b'
              : '#22c55e'
          }
          ${detail.riskResult.riskScore * 3.6}deg,
          #202638 0deg
        )`
      }}
    >
      <div className="gauge-inner">
        <span className="score">
          {detail.riskResult.riskScore}
        </span>
        <span className="max">/100</span>
      </div>
    </div>

    <div className="risk-summary">
      <span className={`risk-level ${detail.riskResult.classification}`}>
        {detail.riskResult.classification} RISK
      </span>

      <strong>
        {detail.riskResult.riskScore >= 70
          ? 'Immediate intervention required'
          : detail.riskResult.riskScore >= 30
          ? 'Requires additional monitoring'
          : 'No significant fraud indicators'}
      </strong>

      <p>
        This classification comes directly from the deterministic
        risk engine. Gemini does not calculate or modify this score.
      </p>
    </div>
  </div>
</div>

{/* RULES */}
<div className="detail-section">
  <div className="section-kicker">DETECTION SIGNALS</div>

  {detail.riskResult.firedRules.length > 0 ? (
    <div className="rule-chips">
      {detail.riskResult.firedRules.map((rule) => (
        <span className="rule-chip rule-chip-alert" key={rule}>
          {rule}
        </span>
      ))}
    </div>
  ) : (
    <div className="no-signals">
      ✓ No deterministic fraud rules triggered
    </div>
  )}
</div>

{/* EVIDENCE */}
<div className="detail-section">
  <div className="section-kicker">BEHAVIORAL EVIDENCE</div>

  <div className="evidence-grid">
    <div className="item">
      <div className="k">VELOCITY · 5 MIN</div>
      <div className="v">
        {detail.features.velocity5m} attempts
      </div>
    </div>

    <div className="item">
      <div className="k">UNIQUE CARDS</div>
      <div className="v">
        {detail.features.uniqueCards5m}
      </div>
    </div>

    <div className="item">
      <div className="k">BIN IP SOURCES</div>
      <div className="v">
        {detail.features.uniqueIPsForBin15m}
      </div>
    </div>

    <div className="item">
      <div className="k">DECLINE RATE</div>
      <div className="v">
        {(detail.features.declineRate15m * 100).toFixed(1)}%
      </div>
    </div>

    <div className="item">
      <div className="k">SMALL AMOUNT RATIO</div>
      <div className="v">
        {(detail.features.smallAmountRatio * 100).toFixed(1)}%
      </div>
    </div>

    <div className="item">
      <div className="k">VELOCITY ANOMALY</div>
      <div className="v">
        Z = {detail.riskResult.velocityZScore}
      </div>
    </div>

    <div className="item">
      <div className="k">DECLINE ANOMALY</div>
      <div className="v">
        Z = {detail.riskResult.declineZScore}
      </div>
    </div>

    <div className="item">
      <div className="k">RULE SCORE</div>
      <div className="v">
        {detail.riskResult.ruleScore}/100
      </div>
    </div>
  </div>
</div>

{/* GEMINI */}
<div className="ai-panel">
  <div className="ai-panel-header">
    ✦ GEMINI RISK ANALYSIS
    <span className="ai-readonly">EVIDENCE ONLY</span>
  </div>

  <p>{detail.aiResult.explanation}</p>

  <div className="ai-result-grid">
    <div>
      <span>AI CLASSIFICATION</span>
      <strong>{detail.aiResult.classification}</strong>
    </div>

    <div>
      <span>AI RECOMMENDATION</span>
      <strong>
        {detail.aiResult.recommended_action}
      </strong>
    </div>
  </div>

  <div className="ai-boundary">
    <span>✓</span>
    Gemini interprets verified evidence only. It does not
    calculate the risk score or have final blocking authority.
  </div>
</div>

{/* POLICY RESULT */}
<div className="detail-section">
  <div className="section-kicker">DECISION RATIONALE</div>

  <div className="decision-rationale">
    <div className="rationale-row">
      <span>Risk engine</span>
      <strong>
        {detail.riskResult.riskScore}/100 ·{' '}
        {detail.riskResult.classification}
      </strong>
    </div>

    <div className="rationale-row">
      <span>Gemini recommendation</span>
      <strong>
        {detail.aiResult.recommended_action}
      </strong>
    </div>

    <div className="rationale-row final">
      <span>Policy gate result</span>
      <strong>
        {detail.finalDecision.finalAction.replaceAll('_', ' ')}
      </strong>
    </div>
  </div>
</div>

{/* OVERRIDE */}
{detail.finalDecision.overrideReason && (
  <div className="override-note">
    <strong>⚠ POLICY OVERRIDE</strong>
    <div style={{ marginTop: 7 }}>
      {detail.finalDecision.overrideReason}
    </div>
  </div>
)}

{/* DECISION CHAIN */}
<div className="detail-section">
  <div className="section-kicker">DECISION CHAIN</div>

  <div className="decision-chain">
    <div className="chain-node">
      <span>01</span>
      TRANSACTION
    </div>

    <div className="chain-arrow">→</div>

    <div className="chain-node">
      <span>02</span>
      FEATURES
    </div>

    <div className="chain-arrow">→</div>

    <div className="chain-node">
      <span>03</span>
      RISK ENGINE
    </div>

    <div className="chain-arrow">→</div>

    <div className="chain-node ai">
      <span>04</span>
      GEMINI
    </div>

    <div className="chain-arrow">→</div>

    <div className="chain-node final">
      <span>05</span>
      POLICY GATE
    </div>
  </div>
</div>

                {/* RISK */}

                <div className="detail-section">
                  <h3>Risk Assessment</h3>

                  <div className="gauge-row">
                    <div
                      className="gauge"
                      style={{
                        background: `conic-gradient(
                          ${
                            detail.riskResult.classification ===
                            'HIGH'
                              ? '#ef4444'
                              : detail.riskResult
                                    .classification ===
                                'MEDIUM'
                              ? '#f59e0b'
                              : '#22c55e'
                          }
                          ${
                            detail.riskResult.riskScore * 3.6
                          }deg,
                          #202638 0deg
                        )`
                      }}
                    >
                      <div className="gauge-inner">
                        <span className="score">
                          {detail.riskResult.riskScore}
                        </span>

                        <span className="max">
                          /100
                        </span>
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          color: '#e2e8f0',
                          fontWeight: 700,
                          fontSize: 15
                        }}
                      >
                        {detail.riskResult.classification}
                      </div>

                      <div
                        style={{
                          color: '#64748b',
                          fontSize: 11,
                          marginTop: 4
                        }}
                      >
                        Deterministic risk engine result
                      </div>
                    </div>
                  </div>
                </div>

                {/* RULES */}

                <div className="detail-section">
                  <h3>Rules Triggered</h3>

                  {detail.riskResult.firedRules.length > 0 ? (
                    <div className="rule-chips">
                      {detail.riskResult.firedRules.map(
                        (rule) => (
                          <span
                            className="rule-chip"
                            key={rule}
                          >
                            {rule}
                          </span>
                        )
                      )}
                    </div>
                  ) : (
                    <span
                      style={{
                        color: '#64748b',
                        fontSize: 12
                      }}
                    >
                      No risk rules triggered.
                    </span>
                  )}
                </div>

                {/* EVIDENCE */}

                <div className="detail-section">
                  <h3>Evidence</h3>

                  <div className="evidence-grid">
                    <div className="item">
                      <div className="k">
                        Velocity · 5 min
                      </div>

                      <div className="v">
                        {detail.features.velocity5m}{' '}
                        attempts
                      </div>
                    </div>

                    <div className="item">
                      <div className="k">
                        Unique cards
                      </div>

                      <div className="v">
                        {detail.features.uniqueCards5m}
                      </div>
                    </div>

                    <div className="item">
                      <div className="k">
                        BIN IP sources
                      </div>

                      <div className="v">
                        {detail.features.uniqueIPsForBin15m}
                      </div>
                    </div>

                    <div className="item">
                      <div className="k">
                        Decline rate
                      </div>

                      <div className="v">
                        {(
                          detail.features.declineRate15m *
                          100
                        ).toFixed(1)}
                        %
                      </div>
                    </div>

                    <div className="item">
                      <div className="k">
                        Small amount ratio
                      </div>

                      <div className="v">
                        {(
                          detail.features.smallAmountRatio *
                          100
                        ).toFixed(1)}
                        %
                      </div>
                    </div>

                    <div className="item">
                      <div className="k">
                        Velocity anomaly
                      </div>

                      <div className="v">
                        Z ={' '}
                        {detail.riskResult.velocityZScore}
                      </div>
                    </div>

                    <div className="item">
                      <div className="k">
                        Decline anomaly
                      </div>

                      <div className="v">
                        Z ={' '}
                        {detail.riskResult.declineZScore}
                      </div>
                    </div>
                  </div>
                </div>

                {/* GEMINI */}

                <div className="ai-panel">
                  <div className="ai-panel-header">
                    ✦ GEMINI RISK ANALYSIS
                  </div>

                  <p>
                    {detail.aiResult.explanation}
                  </p>

                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 12,
                      borderTop:
                        '1px solid rgba(99,102,241,0.18)',
                      display: 'grid',
                      gridTemplateColumns:
                        '1fr 1fr',
                      gap: 10,
                      fontSize: 11
                    }}
                  >
                    <div>
                      <span style={{ color: '#64748b' }}>
                        AI CLASSIFICATION
                      </span>

                      <div
                        style={{
                          color: '#c4b5fd',
                          fontWeight: 700,
                          marginTop: 3
                        }}
                      >
                        {detail.aiResult.classification}
                      </div>
                    </div>

                    <div>
                      <span style={{ color: '#64748b' }}>
                        AI RECOMMENDATION
                      </span>

                      <div
                        style={{
                          color: '#c4b5fd',
                          fontWeight: 700,
                          marginTop: 3
                        }}
                      >
                        {detail.aiResult.recommended_action}
                      </div>
                    </div>
                  </div>
                </div>

                {/* POLICY OVERRIDE */}

                {detail.finalDecision.overrideReason && (
                  <div className="override-note">
                    <strong>
                      ⚠ Policy Override
                    </strong>

                    <div style={{ marginTop: 7 }}>
                      {
                        detail.finalDecision
                          .overrideReason
                      }
                    </div>
                  </div>
                )}

                {/* DECISION CHAIN */}

                <div className="detail-section">
                  <h3>Decision Chain</h3>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 7,
                      color: '#94a3b8',
                      fontSize: 11
                    }}
                  >
                    <span className="rule-chip">
                      TRANSACTION
                    </span>

                    <span>→</span>

                    <span className="rule-chip">
                      FEATURES
                    </span>

                    <span>→</span>

                    <span className="rule-chip">
                      RISK ENGINE
                    </span>

                    <span>→</span>

                    <span className="rule-chip">
                      GEMINI
                    </span>

                    <span>→</span>

                    <span className="rule-chip">
                      POLICY GATE
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;