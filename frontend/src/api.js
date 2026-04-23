// Base URL for all API calls — proxied to http://localhost:4000 via Vite
const BASE = "/api";

/**
 * Fetch current drift status from GET /status
 */
export async function fetchStatus() {
  const res = await fetch(`${BASE}/status`);
  if (!res.ok) throw new Error(`Status API error: ${res.status}`);
  return res.json();
}

/**
 * Trigger a drift detection run via POST /run-drift
 */
export async function runDriftDetection() {
  const res = await fetch(`${BASE}/run-drift`, { method: "POST" });
  if (!res.ok) throw new Error(`Run-drift API error: ${res.status}`);
  return res.json();
}

/**
 * Fetch latest run logs from GET /logs
 */
export async function fetchLogs() {
  const res = await fetch(`${BASE}/logs`);
  if (!res.ok) throw new Error(`Logs API error: ${res.status}`);
  return res.json();
}
