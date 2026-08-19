import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

// Read-only project sharing: store a snapshot of the project's files server-side under a random id,
// and hand back a public link to a read-only viewer (/share/<id>). No code is executed — it's just a
// source snapshot (great for a portfolio). BYOK keys are never part of a project, so nothing secret
// is stored. Snapshots live next to the deploys (a dir the app can already write).
const ROOT = process.env.HIVEY_SHARE_DIR || path.join(process.env.HIVEY_DEPLOY_DIR || "/srv/hivey-deploys", "_src");
const APP_HOST = process.env.HIVEY_APP_HOST || "https://app.hivey.be";
const MAX_BYTES = 8 * 1024 * 1024;

const validId = (id: string) => /^[a-z0-9]{6,16}$/.test(id);

export async function POST(req: Request) {
  let body: { files?: Record<string, string>; name?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const files = body.files || {};
  if (!Object.keys(files).length) return Response.json({ error: "nothing to share" }, { status: 400 });

  // Keep only text files, bounded — never persist anything unexpectedly large.
  const clean: Record<string, string> = {};
  let total = 0;
  for (const [p, c] of Object.entries(files)) {
    if (typeof c !== "string") continue;
    total += c.length;
    if (total > MAX_BYTES) break;
    clean[p] = c;
  }

  // The unguessable URL IS the access control here, so the id must come from a CSPRNG.
  // Math.random() is a fast PRNG, not an unpredictable one: its state can be recovered from a
  // handful of observed outputs, and every id it hands out is an observed output.
  const id = randomBytes(8).toString("hex");
  const payload = JSON.stringify({ name: (body.name || "Shared project").slice(0, 80), files: clean, at: Date.now() });
  try {
    await mkdir(ROOT, { recursive: true });
    await writeFile(path.join(ROOT, `${id}.json`), payload, "utf8");
  } catch (e) {
    return Response.json({ error: "could not store snapshot: " + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
  return Response.json({ id, url: `${APP_HOST}/share/${id}` });
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!validId(id)) return Response.json({ error: "bad id" }, { status: 400 });
  try {
    const raw = await readFile(path.join(ROOT, `${id}.json`), "utf8");
    return new Response(raw, { headers: { "content-type": "application/json", "cache-control": "public, max-age=60" } });
  } catch {
    return Response.json({ error: "not found" }, { status: 404 });
  }
}
