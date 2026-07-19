import { listTools, callTool } from "@/agent/mcp-client";

export const runtime = "nodejs";
export const maxDuration = 60;

// SSRF guard: the MCP url is client-controlled, so block anything pointing at a private/loopback/
// link-local host or the cloud metadata endpoint — otherwise the server could be tricked into
// reaching the internal runner (127.0.0.1:8093), 169.254.169.254, or other intranet hosts and
// returning their bodies to the browser. Best-effort by hostname (DNS-rebinding is out of scope).
function isBlockedHost(rawUrl: string): boolean {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return true;
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host === "::1" || host === "0.0.0.0") return true;
  // IPv4 private / loopback / link-local ranges
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

// Server-side MCP proxy — the browser calls this; we do the JSON-RPC handshake with the external MCP
// server (no CORS, endpoint not exposed to the page). Shares the client with the autonomous agent loop.
export async function POST(req: Request) {
  let body: { action?: string; url?: string; name?: string; args?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const { action, url, name, args } = body;
  if (!url || !/^https?:\/\//.test(url)) return Response.json({ error: "valid MCP server url required" }, { status: 400 });
  if (isBlockedHost(url)) return Response.json({ error: "MCP url host is not allowed (private/loopback/metadata addresses are blocked)" }, { status: 403 });

  try {
    if (action === "list") return Response.json({ tools: await listTools(url) });
    if (action === "call") {
      if (!name) return Response.json({ error: "tool name required" }, { status: 400 });
      return Response.json({ result: { content: [{ type: "text", text: await callTool(url, name, args) }] } });
    }
    return Response.json({ error: "action must be list | call" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
