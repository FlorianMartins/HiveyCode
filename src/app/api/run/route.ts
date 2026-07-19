export const runtime = "nodejs";
export const maxDuration = 200;

// Proxies a compile/run/test job to the hardened local runner service (127.0.0.1:8093), which runs
// it in an ephemeral, network-less, capped Docker container. The runner is never exposed publicly;
// only this server-side route reaches it.
const RUNNER = process.env.HIVEY_RUNNER_URL || "http://127.0.0.1:8093";

export async function POST(req: Request) {
  let body: { files?: Record<string, string>; task?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  if (!["build", "test", "typecheck"].includes(body.task || "")) {
    return Response.json({ error: "task must be build | test | typecheck" }, { status: 400 });
  }

  try {
    const res = await fetch(`${RUNNER}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task: body.task, files: body.files || {} }),
      signal: AbortSignal.timeout(190_000),
    });
    const json = await res.json();
    return Response.json(json, { status: res.status });
  } catch (e) {
    return Response.json(
      { error: "runner unavailable: " + (e instanceof Error ? e.message : String(e)), ok: false },
      { status: 502 },
    );
  }
}
