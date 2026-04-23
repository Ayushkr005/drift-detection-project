import { useState, useEffect, useCallback, useRef } from "react";
import { fetchStatus, runDriftDetection, fetchLogs } from "./api.js";

/* ─── Helpers ───────────────────────────────────────────────────────── */

/** Classify a log line and return a CSS class for colour coding */
function classifyLine(line) {
  if (!line.trim()) return "muted";
  if (line.includes("✅") || line.includes("No changes") || line.includes("successfully"))
    return "green";
  if (line.includes("⚠️") || line.includes("DRIFT") || line.includes("update in-place"))
    return "red";
  if (line.includes("~") || line.includes("->"))
    return "yellow";
  if (line.startsWith("  #") || line.startsWith("  ~"))
    return "yellow";
  if (line.startsWith("Initializing") || line.startsWith("Terraform"))
    return "blue";
  return "default";
}

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/* ─── Sub-Components ────────────────────────────────────────────────── */

function StatusCard({ status, lastChecked, message }) {
  const isHealthy = status === "healthy";
  const dotClass = isHealthy ? "green" : "red";
  const textClass = isHealthy ? "green" : "red";
  const label = isHealthy ? "Healthy ✅" : "Drift Detected ⚠️";

  return (
    <div className={`card status-card ${status}`} id="status-card">
      <div className="card-label">Infrastructure Status</div>
      <div className="status-body">
        <div className="status-badge">
          <span className={`status-dot ${dotClass}`} />
          <span className={`status-text ${textClass}`}>{label}</span>
        </div>
        <div className="status-meta">
          Last checked: {formatTime(lastChecked)}
        </div>
      </div>
      {message && (
        <p style={{ marginTop: 12, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
          {message}
        </p>
      )}
    </div>
  );
}

function InfoGrid({ status, lastChecked }) {
  return (
    <div className="info-grid">
      <div className="info-item">
        <div className="info-item-label">Provider</div>
        <div className="info-item-value">AWS (us-east-1)</div>
      </div>
      <div className="info-item">
        <div className="info-item-label">IaC Tool</div>
        <div className="info-item-value">Terraform 5.x</div>
      </div>
      <div className="info-item">
        <div className="info-item-label">Resources</div>
        <div className="info-item-value">EC2 · S3 · DynamoDB</div>
      </div>
      <div className="info-item">
        <div className="info-item-label">State Backend</div>
        <div className="info-item-value">S3 + DynamoDB Lock</div>
      </div>
    </div>
  );
}

function RunSection({ onRun, running, lastResult }) {
  return (
    <div className="card run-section" id="run-section">
      <div className="card-label">Drift Detection</div>

      {lastResult && (
        <div className={`alert-banner ${lastResult.driftDetected ? "error" : "success"}`}
             style={{ marginBottom: 16 }}>
          <span>{lastResult.driftDetected ? "⚠️" : "✅"}</span>
          <span>{lastResult.message}</span>
          {lastResult.lambdaInvoked && (
            <span style={{ marginLeft: "auto", fontSize: "0.75rem", opacity: 0.8 }}>
              📧 SNS alert sent
            </span>
          )}
        </div>
      )}

      <button
        id="btn-run-drift"
        className={`btn-run ${running ? "loading" : ""}`}
        onClick={onRun}
        disabled={running}
        aria-label="Run drift detection"
      >
        {running ? (
          <>
            <span className="spinner" />
            Running Detection…
          </>
        ) : (
          <>
            <span>▶</span>
            Run Drift Detection
          </>
        )}
      </button>

      <p className="run-hint" style={{ marginTop: 12 }}>
        Simulates <code>terraform plan -detailed-exitcode</code>
        {" "}· ~40% chance of drift in demo mode
      </p>
    </div>
  );
}

function LogsPanel({ logs, status }) {
  const endRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (autoScroll && endRef.current)
      endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [logs, autoScroll]);

  function handleCopy() {
    if (!logs.length) return;
    navigator.clipboard.writeText(logs.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="card" id="logs-panel">
      <div className="logs-header">
        <div className="card-label" style={{ marginBottom: 0 }}>Terraform Output Logs</div>
        <div className="logs-controls">
          <button className="btn-icon" onClick={() => setAutoScroll((v) => !v)}>
            {autoScroll ? "📌 Auto-scroll ON" : "📌 Auto-scroll OFF"}
          </button>
          <button className="btn-icon" onClick={handleCopy}>
            {copied ? "✓ Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div className="terminal" id="terminal-output">
        {/* Window chrome */}
        <div className="terminal-top-bar">
          <span className="dot r" /><span className="dot y" /><span className="dot g" />
          <span className="terminal-title">
            terraform plan -detailed-exitcode · {status === "drift_detected" ? "exit 2" : "exit 0"}
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="terminal-empty">
            <div className="terminal-empty-icon">🖥</div>
            <div>No output yet. Click <strong>Run Drift Detection</strong> to start.</div>
          </div>
        ) : (
          logs.map((line, i) => (
            <span key={i} className={`log-line ${classifyLine(line)}`}>
              {line || "\u00a0"}
              {"\n"}
            </span>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function ArchFlow() {
  const nodes = [
    { icon: "🖥️", name: "Dashboard", sub: "React (Vite)" },
    null, // arrow
    { icon: "⚙️", name: "API Server", sub: "Node / Express" },
    null,
    { icon: "🔍", name: "Detector", sub: "tf plan" },
    null,
    { icon: "λ", name: "Lambda", sub: "Python (boto3)" },
    null,
    { icon: "📢", name: "SNS Topic", sub: "drift-alerts" },
    null,
    { icon: "📧", name: "Email Alert", sub: "Subscriber" },
  ];

  return (
    <div className="card" id="arch-section">
      <div className="card-label">System Architecture Flow</div>
      <div className="arch-grid">
        {nodes.map((n, i) =>
          n === null ? (
            <div key={i} className="arch-arrow">→</div>
          ) : (
            <div key={i} className="arch-node">
              <div className="arch-node-icon">{n.icon}</div>
              <div className="arch-node-name">{n.name}</div>
              <div className="arch-node-sub">{n.sub}</div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

/* ─── App ────────────────────────────────────────────────────────────── */

export default function App() {
  const [state, setState] = useState({
    status: "healthy",
    lastChecked: null,
    message: "Click 'Run Drift Detection' to check your infrastructure.",
  });
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [initError, setInitError] = useState(null);

  // Fetch initial status on mount
  useEffect(() => {
    fetchStatus()
      .then((data) =>
        setState({ status: data.status, lastChecked: data.lastChecked, message: data.message })
      )
      .catch(() => setInitError("⚠️ Backend not reachable. Start the Express server first."));
  }, []);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setLastResult(null);
    try {
      const result = await runDriftDetection();
      setState({
        status: result.status,
        lastChecked: result.lastChecked,
        message: result.message,
      });
      setLogs(result.logs || []);
      setLastResult(result);
    } catch (err) {
      setLastResult({ driftDetected: false, message: "Error: " + err.message });
    } finally {
      setRunning(false);
    }
  }, []);

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="header-icon">🛡️</div>
          <div>
            <h1>Drift Detection Dashboard</h1>
            <p>AWS Infrastructure · Terraform · GitHub Actions</p>
          </div>
        </div>
        <span className="version-badge">v1.0.0 · Demo</span>
      </header>

      {/* Backend error banner */}
      {initError && (
        <div className="alert-banner error">
          <span>⚠️</span>
          <span>{initError}</span>
        </div>
      )}

      {/* Status + Info */}
      <StatusCard
        status={state.status}
        lastChecked={state.lastChecked}
        message={state.message}
      />
      <InfoGrid status={state.status} lastChecked={state.lastChecked} />

      {/* Run Button */}
      <RunSection onRun={handleRun} running={running} lastResult={lastResult} />

      {/* Logs */}
      <LogsPanel logs={logs} status={state.status} />

      {/* Architecture */}
      <ArchFlow />

      {/* Footer */}
      <footer className="footer">
        Built for Drift Detection Mini Project · React + Node.js + AWS Lambda + SNS
      </footer>
    </div>
  );
}
