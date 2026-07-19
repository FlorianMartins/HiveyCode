import { callOR } from "@/agent/openrouter";
import { modelFor } from "@/agent/models";
import { SECURITY_SYSTEM } from "@/agent/roles";
import { summariseFiles } from "@/agent/parse";
import { resolveTarget } from "@/agent/providers";
import type { FileMap, HiveyVariant, SecurityFinding } from "@/agent/types";

export const runtime = "nodejs";
export const maxDuration = 120;

// Defensive security scan of the CURRENT project. BYOK: the key is used in transit only, never stored,
// and we never log the findings' contents. Reuses the normal OpenRouter access + the review-tier model.
export async function POST(req: Request) {
  let body: { files?: FileMap; apiKey?: string; keys?: Record<string, string>; variant?: HiveyVariant };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const { files = {}, apiKey = "", keys = {}, variant = "hivey" } = body;
  if (!apiKey && !Object.keys(keys).length) return Response.json({ error: "Add your OpenRouter API key first." }, { status: 400 });
  if (!Object.keys(files).length) return Response.json({ findings: [] });

  const tgt = resolveTarget(variant, { openrouter: apiKey || "", ...keys });
  const model = tgt.hivey ? modelFor(variant, "reviewer") : tgt.model;

  try {
    const raw = await callOR({
      model,
      apiKey: tgt.apiKey,
      baseUrl: tgt.baseUrl,
      maxTokens: 2200,
      temperature: 0.1,
      messages: [
        { role: "system", content: SECURITY_SYSTEM },
        { role: "user", content: `Audit these project files and return ONLY the JSON findings array.\n\n${summariseFiles(files)}` },
      ],
    });
    return Response.json({ findings: parseFindings(raw, files) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

// Extract the JSON array of findings from the model output (tolerant of stray prose / code fences) and
// normalise each item to a SecurityFinding with a stable id.
function parseFindings(raw: string, files: FileMap): SecurityFinding[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const paths = new Set(Object.keys(files).map((p) => p.replace(/^\.?\//, "")));
  const sevRank = { high: 0, medium: 1, low: 2 } as const;
  const out: SecurityFinding[] = [];
  for (let i = 0; i < arr.length; i++) {
    const f = arr[i] as Record<string, unknown>;
    if (!f || typeof f !== "object") continue;
    const severity = f.severity === "high" || f.severity === "low" ? f.severity : "medium";
    let file = typeof f.file === "string" ? f.file.replace(/^\.?\//, "") : "";
    if (file && !paths.has(file)) {
      // keep only if it resolves to a real project file (avoids hallucinated paths)
      const match = [...paths].find((p) => p.endsWith(file) || file.endsWith(p));
      file = match || file;
    }
    out.push({
      id: `sec-${i}-${String(f.title || "").slice(0, 24).replace(/\W+/g, "-")}`,
      severity,
      title: String(f.title || "Security finding"),
      file,
      line: Number.isFinite(Number(f.line)) ? Number(f.line) : 0,
      category: String(f.category || "owasp"),
      why: String(f.why || ""),
      fix: String(f.fix || ""),
      status: "open",
    });
  }
  out.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
  return out;
}
