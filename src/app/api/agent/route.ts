import { runAgents } from "@/agent/orchestrator";
import { LOCAL_IDS } from "@/agent/providers";
import type { AgentRequest } from "@/agent/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// Streams the agent loop back to the browser as NDJSON (one JSON event per line).
export async function POST(req: Request) {
  let body: AgentRequest;
  try {
    body = (await req.json()) as AgentRequest;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // A local provider (Ollama/LM Studio/custom, "provider|model") needs no key. Any other
  // provider (incl. the Hivey presets, which route through OpenRouter) requires the key.
  const localProvider = typeof body.variant === "string" && body.variant.includes("|") && LOCAL_IDS.has(body.variant.split("|")[0]);
  const hasAnyKey = body.apiKey || Object.values(body.keys || {}).some(Boolean);
  if (!hasAnyKey && !localProvider) {
    return new Response(JSON.stringify({ type: "error", message: "Add your OpenRouter API key first." }) + "\n", {
      status: 200,
      headers: { "content-type": "application/x-ndjson" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of runAgents(body)) {
          controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
        }
      } catch (e) {
        controller.enqueue(
          encoder.encode(JSON.stringify({ type: "error", message: e instanceof Error ? e.message : String(e) }) + "\n"),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson", "cache-control": "no-cache" },
  });
}
