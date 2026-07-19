"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { useAgent } from "@/hooks/useAgent";
import type { SecurityFinding } from "@/agent/types";
import { quickScan } from "@/lib/quickScan";
import { securityScore, scoreGrade, loadScanHistory, recordScanSnapshot, buildReportMarkdown, downloadText, printReport, type ScanSnapshot } from "@/lib/securityReport";
import { ShieldCheck, ShieldAlert, ScanLine, Loader2, Wrench, Check, ChevronRight, ChevronDown, Boxes, Zap, PlayCircle, Wand2, FileDown, Printer } from "lucide-react";

const SEV = {
  high: { label: "High", dot: "bg-red-500", text: "text-red-400", ring: "border-red-500/40" },
  medium: { label: "Medium", dot: "bg-amber-500", text: "text-amber-400", ring: "border-amber-500/40" },
  low: { label: "Low", dot: "bg-sky-500", text: "text-sky-400", ring: "border-sky-500/30" },
} as const;

// Hardening checklist rows: each is "satisfied" (checked) when the scan found NO open issue in its
// categories. An open finding means that area still needs work (unchecked, links to the finding).
const CHECKS: { label: string; cats: string[] }[] = [
  { label: "No hardcoded secrets", cats: ["secret"] },
  { label: "Input validation", cats: ["validation", "injection"] },
  { label: "XSS-safe rendering", cats: ["xss"] },
  { label: "Auth & secret management", cats: ["auth"] },
  { label: "Security headers / CSP", cats: ["headers"] },
  { label: "Dependency hygiene", cats: ["deps"] },
];

export function SecurityPanel() {
  const findings = useStore((s) => s.securityFindings);
  const scanning = useStore((s) => s.securityScanning);
  const running = useStore((s) => s.running);
  const hasFiles = useStore((s) => Object.keys(s.files).length > 0);
  const { scanSecurity, deepScan, fixFindingsBatch } = useAgent();
  const setSecurityFindings = useStore((s) => s.setSecurityFindings);
  const projectId = useStore((s) => s.projectId);
  const [history, setHistory] = useState<ScanSnapshot[]>([]);

  const score = useMemo(() => securityScore(findings), [findings]);
  const grade = scoreGrade(score);

  // Load this project's scan history + record a snapshot whenever findings settle (not mid-scan).
  useEffect(() => { setHistory(loadScanHistory(projectId)); }, [projectId]);
  useEffect(() => {
    if (scanning || running || findings.length === 0) return;
    const t = setTimeout(() => setHistory(recordScanSnapshot(projectId, findings, Date.now())), 400);
    return () => clearTimeout(t);
  }, [findings, scanning, running, projectId]);

  const lowFindings = findings.filter((f) => f.status !== "fixed" && f.severity === "low");
  const projectName = useStore.getState().projects.find((p) => p.id === projectId)?.name || "Project";
  const exportReport = (kind: "md" | "pdf") => {
    const date = new Date().toLocaleString();
    if (kind === "md") downloadText(`security-report-${projectName.replace(/\W+/g, "-").toLowerCase()}.md`, buildReportMarkdown(projectName, findings, date));
    else printReport(projectName, findings, date);
  };

  // Instant offline pass (secrets + dangerous patterns). Replaces prior quick-* findings, keeps the rest.
  const runQuick = () => {
    const files = useStore.getState().files;
    const quick = quickScan(files);
    const others = useStore.getState().securityFindings.filter((f) => !f.id.startsWith("quick-"));
    const rank = { high: 0, medium: 1, low: 2 } as const;
    setSecurityFindings([...others, ...quick].sort((a, b) => rank[a.severity] - rank[b.severity]));
  };

  // Run every scan back-to-back: AI scan (replaces) → Deep scan (npm audit + semgrep) → Quick scan.
  const [autoRunning, setAutoRunning] = useState(false);
  const runAll = async () => {
    if (autoRunning || scanning || running || !hasFiles) return;
    setAutoRunning(true);
    try {
      await scanSecurity(); // needs a key; if absent it no-ops and we continue
      await deepScan(); // runner-based, no key needed
      runQuick(); // instant, keeps the rest
    } finally {
      setAutoRunning(false);
    }
  };

  const open = findings.filter((f) => f.status !== "fixed");
  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    for (const f of open) c[f.severity]++;
    return c;
  }, [open]);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white/[0.01]">
      {/* Guardrail banner */}
      <div className="flex items-start gap-2 border-b border-border-soft bg-hivey-grad-soft/40 px-3 py-2 text-[11px] text-muted">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" />
        <span>Defensive hardening aid — not a guarantee of completeness, nor a security certification. No offensive/exploit tooling.</span>
      </div>

      {/* Score + scan history */}
      {(findings.length > 0 || history.length > 0) && (
        <div className="flex items-center gap-3 border-b border-border-soft px-3 py-2">
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-bold ${grade.tone === "good" ? "text-emerald-400" : grade.tone === "warn" ? "text-amber-400" : "text-red-400"}`}>{score}</span>
            <span className="text-[11px] text-muted">/100</span>
          </div>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${grade.tone === "good" ? "bg-emerald-500/15 text-emerald-400" : grade.tone === "warn" ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`}>{grade.label}</span>
          {history.length > 1 && (
            <div className="ml-auto flex items-end gap-0.5" title="Scan history — security score over time">
              {history.slice(-16).map((h, i) => (
                <span
                  key={i}
                  className={`w-1.5 rounded-sm ${h.score >= 85 ? "bg-emerald-500/70" : h.score >= 60 ? "bg-amber-500/70" : "bg-red-500/70"}`}
                  style={{ height: `${Math.max(3, Math.round((h.score / 100) * 22))}px` }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border-soft px-3 py-2">
        <button
          onClick={runAll}
          disabled={autoRunning || scanning || running || !hasFiles}
          title="Run every scan automatically: AI scan → dependency + static analysis (runner) → instant secrets/patterns"
          className="inline-flex items-center gap-1.5 rounded-lg bg-hivey-grad px-3 py-1.5 text-[12px] font-medium text-on-accent transition-opacity disabled:opacity-50"
        >
          {autoRunning ? <Loader2 size={13} className="animate-spin" /> : <PlayCircle size={13} />}
          {autoRunning ? "Running all…" : "Run all"}
        </button>
        <button
          onClick={() => scanSecurity()}
          disabled={scanning || running || !hasFiles}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] text-text transition-colors hover:border-accent disabled:opacity-50"
        >
          {scanning ? <Loader2 size={13} className="animate-spin" /> : <ScanLine size={13} />}
          {scanning ? "Scanning…" : "AI scan"}
        </button>
        <button
          onClick={runQuick}
          disabled={!hasFiles}
          title="Instant offline scan: hardcoded secrets + dangerous patterns (eval, exec, innerHTML…)"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] text-text transition-colors hover:border-accent disabled:opacity-50"
        >
          <Zap size={13} /> Quick scan
        </button>
        <button
          onClick={() => deepScan()}
          disabled={scanning || running || !hasFiles}
          title="Deep scan in the hardened runner: npm audit (dependency CVEs) + semgrep (static analysis)"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] text-text transition-colors hover:border-accent disabled:opacity-50"
        >
          <Boxes size={13} /> Deep scan
        </button>
        {open.length > 0 && (
          <button
            onClick={() => fixFindingsBatch(open)}
            disabled={running || scanning}
            title="Auto-fix ALL findings — low, medium AND high risk — in one defensive pass. Review the diff before keeping."
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] text-text transition-colors hover:border-accent disabled:opacity-50"
          >
            <Wand2 size={13} /> Fix all ({open.length})
          </button>
        )}
        {lowFindings.length > 0 && lowFindings.length < open.length && (
          <button
            onClick={() => fixFindingsBatch(lowFindings)}
            disabled={running || scanning}
            title="Auto-fix only the LOW-risk findings (safer subset)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-accent hover:text-text disabled:opacity-50"
          >
            <Wand2 size={13} /> Low-risk ({lowFindings.length})
          </button>
        )}
        {findings.length > 0 && (
          <>
            <button
              onClick={() => exportReport("md")}
              title="Export the scan report as Markdown"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:border-accent hover:text-text"
            >
              <FileDown size={13} /> MD
            </button>
            <button
              onClick={() => exportReport("pdf")}
              title="Export the scan report as PDF (print dialog)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:border-accent hover:text-text"
            >
              <Printer size={13} /> PDF
            </button>
          </>
        )}
        {findings.length > 0 && (
          <div className="flex items-center gap-2 text-[11px]">
            {(["high", "medium", "low"] as const).map((s) =>
              counts[s] ? (
                <span key={s} className={`inline-flex items-center gap-1 ${SEV[s].text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${SEV[s].dot}`} /> {counts[s]} {SEV[s].label.toLowerCase()}
                </span>
              ) : null,
            )}
            {open.length === 0 && <span className="inline-flex items-center gap-1 text-emerald-400"><Check size={12} /> All clear</span>}
          </div>
        )}
      </div>

      {/* Findings */}
      <div className="flex flex-col gap-2 p-3">
        {findings.length === 0 && !scanning && (
          <div className="rounded-lg border border-border-soft p-4 text-center text-[12px] text-muted">
            <ShieldAlert size={20} className="mx-auto mb-2 opacity-50" />
            {hasFiles ? "Run a scan to audit this project for security issues." : "Build or open a project first, then scan it."}
          </div>
        )}
        {findings.map((f) => (
          <FindingCard key={f.id} f={f} />
        ))}
      </div>

      {/* Hardening checklist */}
      {findings.length > 0 && (
        <div className="border-t border-border-soft p-3">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">Hardening checklist</div>
          <div className="flex flex-col gap-1">
            {CHECKS.map((row) => {
              const issue = open.find((f) => row.cats.includes(f.category));
              const ok = !issue;
              return (
                <div key={row.label} className="flex items-center gap-2 text-[12px]">
                  <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${ok ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-400" : "border-border text-transparent"}`}>
                    <Check size={11} />
                  </span>
                  <span className={ok ? "text-text" : "text-muted"}>{row.label}</span>
                  {issue && <span className="ml-auto text-[10px] text-amber-400">{open.filter((f) => row.cats.includes(f.category)).length} to fix</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function FindingCard({ f }: { f: SecurityFinding }) {
  const [open, setOpen] = useState(false);
  const setActiveFile = useStore((s) => s.setActiveFile);
  const requestCode = useStore((s) => s.requestCode);
  const { fixFinding } = useAgent();
  const running = useStore((s) => s.running);
  const sev = SEV[f.severity];
  const fixed = f.status === "fixed";

  return (
    <div className={`rounded-lg border ${fixed ? "border-border-soft opacity-60" : sev.ring} bg-panel/40`}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-2.5 py-2 text-left">
        {open ? <ChevronDown size={13} className="shrink-0 text-muted" /> : <ChevronRight size={13} className="shrink-0 text-muted" />}
        <span className={`h-2 w-2 shrink-0 rounded-full ${sev.dot}`} />
        <span className={`truncate text-[12px] ${fixed ? "line-through" : "text-text"}`}>{f.title}</span>
        {fixed && <span className="ml-1 shrink-0 text-[10px] text-emerald-400">fixed</span>}
        <span className="ml-auto shrink-0 rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-muted">{f.category}</span>
      </button>
      {open && (
        <div className="border-t border-border-soft px-3 py-2 text-[12px] text-text">
          {f.file && (
            <button
              onClick={() => {
                setActiveFile(f.file);
                requestCode();
              }}
              className="mb-1.5 inline-block font-mono text-[11px] text-accent hover:underline"
            >
              {f.file}
              {f.line ? `:${f.line}` : ""}
            </button>
          )}
          {f.why && <p className="mb-1.5 text-muted">{f.why}</p>}
          {f.fix && (
            <p className="mb-2">
              <span className="text-muted">Fix: </span>
              {f.fix}
            </p>
          )}
          {!fixed && (
            <button
              onClick={() => fixFinding(f)}
              disabled={running}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] text-text transition-colors hover:border-accent disabled:opacity-50"
            >
              <Wrench size={12} /> Fix with the agents
            </button>
          )}
        </div>
      )}
    </div>
  );
}
