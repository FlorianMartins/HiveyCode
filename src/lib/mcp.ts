// Thin browser wrapper around /api/mcp (which does the real JSON-RPC handshake server-side).

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export async function mcpListTools(url: string): Promise<McpTool[]> {
  const res = await fetch("/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "list", url }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error);
  return j.tools || [];
}

export async function mcpCallTool(url: string, name: string, args: unknown): Promise<string> {
  const res = await fetch("/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "call", url, name, args }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error);
  // MCP tool results are a content array ({type:'text',text} | …) — flatten the text.
  const content = j.result?.content;
  if (Array.isArray(content)) {
    return content.map((c: { type?: string; text?: string }) => (c.type === "text" ? c.text : JSON.stringify(c))).join("\n");
  }
  return JSON.stringify(j.result ?? {}, null, 2);
}
