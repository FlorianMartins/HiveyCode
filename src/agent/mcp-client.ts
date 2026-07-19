// Server-side MCP (Model Context Protocol) client over the Streamable HTTP transport. Shared by the
// /api/mcp route and the autonomous agent loop. Each call does a fresh initialize handshake (stateless
// from the caller's view), reusing the session-id the server returns.

interface Rpc {
  jsonrpc: "2.0";
  id?: number;
  method: string;
  params?: unknown;
}

// SSRF guard — the MCP url is user-supplied. Block private/loopback/link-local/metadata hosts so this
// server can't be turned into a proxy to the internal runner or cloud metadata. Applied at the single
// fetch choke point, so BOTH the /api/mcp route and the autonomous agent loop are covered.
function assertPublicUrl(rawUrl: string): void {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    throw new Error("invalid MCP url");
  }
  const blocked =
    host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host === "::1" || host === "0.0.0.0";
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  const ipBlocked =
    !!m &&
    (() => {
      const a = Number(m[1]);
      const b = Number(m[2]);
      return a === 127 || a === 10 || a === 0 || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31);
    })();
  if (blocked || ipBlocked) throw new Error("MCP url host is not allowed (private/loopback/metadata addresses are blocked)");
}

async function rpc(url: string, msg: Rpc, sessionId?: string): Promise<{ result?: any; error?: any; sessionId?: string }> {
  assertPublicUrl(url);
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json, text/event-stream" };
  if (sessionId) headers["mcp-session-id"] = sessionId;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(msg), signal: AbortSignal.timeout(30_000) });
  const sid = res.headers.get("mcp-session-id") || sessionId;
  if (!res.ok) return { error: `HTTP ${res.status}`, sessionId: sid };
  if (msg.id === undefined) return { sessionId: sid };

  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  let payload: any = null;
  if (ct.includes("text/event-stream")) {
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (t.startsWith("data:")) {
        try {
          payload = JSON.parse(t.slice(5).trim());
        } catch {}
      }
    }
  } else {
    try {
      payload = JSON.parse(text);
    } catch {}
  }
  return { result: payload?.result, error: payload?.error, sessionId: sid };
}

async function handshake(url: string): Promise<string | undefined> {
  const init = await rpc(url, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "hivey-code", version: "1.0" } },
  });
  if (init.error) throw new Error("initialize failed: " + JSON.stringify(init.error));
  await rpc(url, { jsonrpc: "2.0", method: "notifications/initialized" }, init.sessionId);
  return init.sessionId;
}

export interface McpToolDef {
  name: string;
  description?: string;
  inputSchema?: any;
}

export async function listTools(url: string): Promise<McpToolDef[]> {
  const sid = await handshake(url);
  const r = await rpc(url, { jsonrpc: "2.0", id: 2, method: "tools/list" }, sid);
  if (r.error) throw new Error(JSON.stringify(r.error));
  return r.result?.tools || [];
}

export async function callTool(url: string, name: string, args: unknown): Promise<string> {
  const sid = await handshake(url);
  const r = await rpc(url, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name, arguments: args || {} } }, sid);
  if (r.error) throw new Error(JSON.stringify(r.error));
  const content = r.result?.content;
  if (Array.isArray(content)) {
    return content.map((c: { type?: string; text?: string }) => (c.type === "text" ? c.text : JSON.stringify(c))).join("\n");
  }
  return JSON.stringify(r.result ?? {});
}
