import type { FileMap, SecurityFinding } from "@/agent/types";

export const runtime = "nodejs";
export const maxDuration = 200;

// Phase-2 DEEP security scan: runs `npm audit` (dependency advisories) and `semgrep` (static analysis)
// inside the hardened runner and normalises their output to SecurityFinding[]. Defensive only — the
// scanners never execute project code; the runner is never exposed publicly.
const RUNNER = process.env.HIVEY_RUNNER_URL || "http://127.0.0.1:8093";

async function runTask(task: string, files: FileMap): Promise<{ output?: string; error?: string }> {
  try {
    const res = await fetch(`${RUNNER}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task, files }),
      signal: AbortSignal.timeout(195_000),
    });
    const j = (await res.json()) as { output?: string; error?: string };
    return j;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

const sevMap: Record<string, "high" | "medium" | "low"> = {
  critical: "high",
  high: "high",
  moderate: "medium",
  medium: "medium",
  low: "low",
  info: "low",
  error: "high",
  warning: "medium",
};

function parseAudit(output: string): SecurityFinding[] {
  let j: any;
  try {
    j = JSON.parse(output);
  } catch {
    return [];
  }
  const vulns = j?.vulnerabilities || {};
  const out: SecurityFinding[] = [];
  let i = 0;
  for (const name of Object.keys(vulns)) {
    const v = vulns[name];
    const via = Array.isArray(v.via) ? v.via.find((x: any) => typeof x === "object") : null;
    out.push({
      id: `audit-${i++}-${name}`,
      severity: sevMap[String(v.severity).toLowerCase()] || "medium",
      title: `Vulnerable dependency: ${name}`,
      file: "package.json",
      line: 0,
      category: "deps",
      why: via?.title ? `${via.title}${via.url ? ` (${via.url})` : ""}` : `${name} has a known ${v.severity} vulnerability.`,
      fix: v.fixAvailable ? `Update ${name} (run \`npm audit fix\`${typeof v.fixAvailable === "object" && v.fixAvailable.isSemVerMajor ? " --force (major update)" : ""}).` : `Update ${name} to a patched version or replace it.`,
      status: "open",
    });
  }
  return out;
}

function catFromRule(id: string): string {
  const s = id.toLowerCase();
  if (s.includes("secret") || s.includes("hardcoded") || s.includes("token")) return "secret";
  if (s.includes("xss")) return "xss";
  if (s.includes("sqli") || s.includes("sql-injection") || s.includes("injection") || s.includes("command") || s.includes("eval")) return "injection";
  if (s.includes("csrf") || s.includes("cors") || s.includes("header") || s.includes("csp")) return "headers";
  if (s.includes("auth") || s.includes("jwt") || s.includes("crypto") || s.includes("password")) return "auth";
  return "owasp";
}

function parseSemgrep(output: string): SecurityFinding[] {
  let j: any;
  try {
    j = JSON.parse(output);
  } catch {
    return [];
  }
  const results = Array.isArray(j?.results) ? j.results : [];
  return results.slice(0, 100).map((r: any, i: number) => {
    const id = String(r.check_id || "rule");
    const short = id.split(".").pop() || id;
    return {
      id: `semgrep-${i}-${short}`,
      severity: sevMap[String(r.extra?.severity).toLowerCase()] || "medium",
      title: r.extra?.message ? String(r.extra.message).split(". ")[0].slice(0, 100) : short.replace(/[-_]/g, " "),
      file: String(r.path || "").replace(/^\.?\//, ""),
      line: Number(r.start?.line) || 0,
      category: catFromRule(id),
      why: String(r.extra?.message || "").slice(0, 400),
      fix: r.extra?.metadata?.references?.[0] ? `See ${r.extra.metadata.references[0]}` : "Review and remediate per the rule guidance.",
      status: "open" as const,
    };
  });
}

export async function POST(req: Request) {
  let body: { files?: FileMap };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const files = body.files || {};
  if (!Object.keys(files).length) return Response.json({ findings: [], tools: {} });

  const [audit, semgrep] = await Promise.all([runTask("audit", files), runTask("semgrep", files)]);
  const findings = [...parseAudit(audit.output || ""), ...parseSemgrep(semgrep.output || "")];
  const rank = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity]);

  return Response.json({
    findings,
    tools: {
      audit: audit.error ? { ok: false, error: audit.error } : { ok: true, count: parseAudit(audit.output || "").length },
      semgrep: semgrep.error ? { ok: false, error: semgrep.error } : { ok: true, count: parseSemgrep(semgrep.output || "").length },
    },
  });
}
