import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 200;

// Build the project in the hardened sandbox, then publish its dist/ as a static site served from a
// SEPARATE origin (deploys.hivey.be) so a generated app can never read app.hivey.be's localStorage
// (the BYOK key). The runner does the build offline & isolated; we only write static assets.
const RUNNER = process.env.HIVEY_RUNNER_URL || "http://127.0.0.1:8093";
const DEPLOY_ROOT = process.env.HIVEY_DEPLOY_DIR || "/srv/hivey-deploys";
const DEPLOY_HOST = process.env.HIVEY_DEPLOY_HOST || "https://deploys.hivey.be";

function safeRel(p: string): string | null {
  const norm = p.replace(/\\/g, "/").replace(/^\.?\//, "");
  if (norm.includes("..") || norm.startsWith("/") || norm.length > 400) return null;
  if (!/^[\w./@ -]+$/.test(norm)) return null;
  return norm;
}

export async function POST(req: Request) {
  let body: { files?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  if (!body.files || Object.keys(body.files).length === 0) {
    return Response.json({ error: "nothing to deploy" }, { status: 400 });
  }

  // 1) Build + get dist from the sandbox.
  let dist: Record<string, string> | undefined;
  let output = "";
  try {
    const res = await fetch(`${RUNNER}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task: "deploy", files: body.files }),
      signal: AbortSignal.timeout(195_000),
    });
    const j = await res.json();
    if (!j.ok) return Response.json({ ok: false, error: "build failed", output: j.output || j.error }, { status: 200 });
    dist = j.dist;
    output = j.output || "";
  } catch (e) {
    return Response.json({ error: "runner unavailable: " + (e instanceof Error ? e.message : String(e)) }, { status: 502 });
  }

  if (!dist || Object.keys(dist).length === 0) {
    return Response.json({ ok: false, error: "build produced no dist/", output }, { status: 200 });
  }

  // 2) Write the static assets under a random deploy id.
  // The unguessable URL IS the access control here, so the id must come from a CSPRNG.
  // Math.random() is a fast PRNG, not an unpredictable one: its state can be recovered from a
  // handful of observed outputs, and every id it hands out is an observed output.
  const id = randomBytes(8).toString("hex");
  const dir = path.join(DEPLOY_ROOT, id);
  try {
    for (const [rel, b64] of Object.entries(dist)) {
      const safe = safeRel(rel);
      if (!safe) continue;
      const full = path.join(dir, safe);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, Buffer.from(b64, "base64"));
    }
  } catch (e) {
    return Response.json({ error: "publish failed: " + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }

  return Response.json({ ok: true, url: `${DEPLOY_HOST}/${id}/`, files: Object.keys(dist).length });
}
