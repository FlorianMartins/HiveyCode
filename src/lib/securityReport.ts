import type { SecurityFinding } from "@/agent/types";

// A simple, transparent security score (0–100): start at 100 and subtract a weighted penalty per
// OPEN finding. It is an indicator to track improvement over time — NOT a certification.
const WEIGHT = { high: 15, medium: 6, low: 2 } as const;

export function securityScore(findings: SecurityFinding[]): number {
  const open = findings.filter((f) => f.status !== "fixed");
  const penalty = open.reduce((sum, f) => sum + (WEIGHT[f.severity] || 0), 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function scoreGrade(score: number): { label: string; tone: "good" | "warn" | "bad" } {
  if (score >= 85) return { label: "Good", tone: "good" };
  if (score >= 60) return { label: "Fair", tone: "warn" };
  return { label: "At risk", tone: "bad" };
}

export interface ScanSnapshot { at: number; score: number; high: number; medium: number; low: number }

const histKey = (projectId: string) => `hivey.secHistory.${projectId}`;

export function loadScanHistory(projectId: string): ScanSnapshot[] {
  try {
    return JSON.parse(localStorage.getItem(histKey(projectId)) || "[]") as ScanSnapshot[];
  } catch {
    return [];
  }
}

// Record a snapshot, de-duping when the score is identical to the latest (avoids noise on re-render).
export function recordScanSnapshot(projectId: string, findings: SecurityFinding[], at: number): ScanSnapshot[] {
  const open = findings.filter((f) => f.status !== "fixed");
  const snap: ScanSnapshot = {
    at,
    score: securityScore(findings),
    high: open.filter((f) => f.severity === "high").length,
    medium: open.filter((f) => f.severity === "medium").length,
    low: open.filter((f) => f.severity === "low").length,
  };
  const hist = loadScanHistory(projectId);
  const last = hist[hist.length - 1];
  if (last && last.score === snap.score && last.high === snap.high && last.medium === snap.medium && last.low === snap.low) return hist;
  const next = [...hist, snap].slice(-30);
  try { localStorage.setItem(histKey(projectId), JSON.stringify(next)); } catch {}
  return next;
}

// ----- Report export ---------------------------------------------------------
export function buildReportMarkdown(project: string, findings: SecurityFinding[], dateStr: string): string {
  const score = securityScore(findings);
  const open = findings.filter((f) => f.status !== "fixed");
  const bySev = (s: SecurityFinding["severity"]) => open.filter((f) => f.severity === s);
  const lines: string[] = [];
  lines.push(`# Security report — ${project}`);
  lines.push("");
  lines.push(`- **Date:** ${dateStr}`);
  lines.push(`- **Score:** ${score}/100`);
  lines.push(`- **Open findings:** ${open.length} (high: ${bySev("high").length}, medium: ${bySev("medium").length}, low: ${bySev("low").length})`);
  lines.push("");
  lines.push(`> Defensive hardening aid — not a certification of completeness.`);
  lines.push("");
  for (const sev of ["high", "medium", "low"] as const) {
    const items = bySev(sev);
    if (!items.length) continue;
    lines.push(`## ${sev.toUpperCase()} (${items.length})`);
    lines.push("");
    for (const f of items) {
      lines.push(`### ${f.title}`);
      lines.push(`- **Category:** ${f.category}`);
      if (f.file) lines.push(`- **Location:** \`${f.file}${f.line ? `:${f.line}` : ""}\``);
      lines.push(`- **Why:** ${f.why}`);
      lines.push(`- **Fix:** ${f.fix}`);
      lines.push("");
    }
  }
  const fixed = findings.filter((f) => f.status === "fixed");
  if (fixed.length) {
    lines.push(`## Fixed (${fixed.length})`);
    lines.push("");
    for (const f of fixed) lines.push(`- ~~${f.title}~~ (${f.category})`);
    lines.push("");
  }
  return lines.join("\n");
}

export function downloadText(filename: string, text: string, mime = "text/markdown") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Open a printable window (the user picks "Save as PDF"). Self-contained HTML, no external assets.
export function printReport(project: string, findings: SecurityFinding[], dateStr: string) {
  const score = securityScore(findings);
  const open = findings.filter((f) => f.status !== "fixed");
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
  const rows = open
    .map(
      (f) =>
        `<tr><td class="sev ${f.severity}">${f.severity}</td><td><b>${esc(f.title)}</b><div class="cat">${esc(f.category)}${f.file ? ` · ${esc(f.file)}${f.line ? ":" + f.line : ""}` : ""}</div><div class="why">${esc(f.why)}</div><div class="fix"><b>Fix:</b> ${esc(f.fix)}</div></td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Security report — ${esc(project)}</title>
<style>
  body{font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:32px;max-width:800px}
  h1{margin:0 0 4px} .meta{color:#555;margin-bottom:16px}
  .score{font-size:40px;font-weight:800}
  table{border-collapse:collapse;width:100%;margin-top:12px}
  td{border-top:1px solid #ddd;padding:10px;vertical-align:top}
  .sev{font-weight:700;text-transform:uppercase;font-size:11px;width:70px}
  .sev.high{color:#c0392b}.sev.medium{color:#b9770e}.sev.low{color:#2c6e49}
  .cat{color:#777;font-size:12px;margin:2px 0}.why{margin:4px 0}.fix{color:#333;font-size:13px}
  .note{color:#888;font-size:12px;margin-top:8px}
</style></head><body>
  <h1>Security report — ${esc(project)}</h1>
  <div class="meta">${esc(dateStr)}</div>
  <div class="score">${score}<span style="font-size:18px;color:#888">/100</span></div>
  <div class="meta">${open.length} open finding(s)</div>
  <table>${rows || '<tr><td colspan="2">No open findings 🎉</td></tr>'}</table>
  <p class="note">Defensive hardening aid — not a certification of completeness.</p>
  <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script>
</body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}
