// 🐝 Hivey Code — low-level OpenRouter access (BYOK). The user's key lives only in their browser
// and is sent per-request; we never store it. Mirrors the sidebar/HiveyCode approach.

export interface ORMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Prompt caching (Anthropic/Gemini/DeepSeek via OpenRouter): mark the SYSTEM prompt as a cache
// breakpoint so its tokens aren't re-processed on every turn. Ignored by models that don't support
// it, so it's always safe to send.
function withPromptCache(messages: ORMessage[]): unknown[] {
  return messages.map((m) =>
    m.role === "system"
      ? { role: m.role, content: [{ type: "text", text: m.content, cache_control: { type: "ephemeral" } }] }
      : m,
  );
}

// Friendly error — a 401 means the API key is rejected, not a transient model issue.
export function orError(status: number, text: string): Error {
  if (status === 401) {
    return new Error(
      "OpenRouter rejected your API key (401 — invalid, expired or “User not found”). " +
        "Check it (top-right) or create a new one at openrouter.ai/keys.",
    );
  }
  if (status === 402) return new Error("Out of OpenRouter credits (402). Add credits, or use Hivey Free.");
  return new Error(`OpenRouter ${status}: ${text.slice(0, 300)}`);
}

const OR = "https://openrouter.ai/api/v1";

export interface TokenUsage {
  prompt: number;
  completion: number;
  cost: number; // real $ cost (OpenRouter); 0 for local / when unavailable
}

// Normalise an OpenAI/OpenRouter `usage` object into our TokenUsage shape.
function parseUsage(u: unknown): TokenUsage | undefined {
  if (!u || typeof u !== "object") return undefined;
  const o = u as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" ? v : 0);
  return {
    prompt: num(o.prompt_tokens),
    completion: num(o.completion_tokens),
    cost: num(o.cost) || num((o.cost_details as Record<string, unknown> | undefined)?.upstream_inference_cost),
  };
}

// Build request headers. The Authorization header is only sent when a key exists — a
// LOCAL server (Ollama/LM Studio) needs no key, and sending an empty "Bearer " can make
// some strict servers reject the call. The OpenRouter attribution headers are only sent
// to OpenRouter itself (a local server has no use for them).
function orHeaders(apiKey: string, baseUrl: string): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) h.authorization = `Bearer ${apiKey}`;
  if (/openrouter\.ai/.test(baseUrl)) {
    h["HTTP-Referer"] = "https://app.hivey.be";
    h["X-Title"] = "Hivey Code";
  }
  return h;
}

export async function callOR(opts: {
  model: string;
  messages: ORMessage[];
  apiKey: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  reasoning?: "off" | "high" | "max";
  signal?: AbortSignal;
  onUsage?: (u: TokenUsage) => void;
}): Promise<string> {
  const { model, messages, apiKey, baseUrl = OR, maxTokens = 4000, temperature = 0.4, reasoning, signal, onUsage } = opts;

  const body: Record<string, unknown> = {
    model,
    messages: withPromptCache(messages),
    max_tokens: maxTokens,
    temperature,
  };

  // OpenRouter reasoning effort — only sent when the user explicitly opts in (cost control).
  if (reasoning && reasoning !== "off") {
    body.reasoning = { effort: reasoning };
  }
  if (onUsage && /openrouter\.ai/.test(baseUrl)) body.usage = { include: true };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: orHeaders(apiKey, baseUrl),
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw orError(res.status, text);
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: unknown };
  if (onUsage) {
    const u = parseUsage(json.usage);
    if (u) onUsage(u);
  }
  return (json.choices?.[0]?.message?.content || "").trim();
}

export interface ToolDef {
  type: "function";
  function: { name: string; description?: string; parameters: unknown };
}
export interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

// Tool-calling variant — returns the assistant message, which may request tool calls. Used by the
// autonomous agent loop. `messages` may include prior assistant/tool turns.
export async function callORTools(opts: {
  model: string;
  messages: any[];
  tools: ToolDef[];
  apiKey: string;
  baseUrl?: string;
  maxTokens?: number;
  reasoning?: "off" | "high" | "max";
}): Promise<{ content: string; toolCalls: ToolCall[] }> {
  const { model, messages, tools, apiKey, baseUrl = OR, maxTokens = 4000, reasoning } = opts;
  const body: Record<string, unknown> = { model, messages: withPromptCache(messages), max_tokens: maxTokens, temperature: 0.3 };
  if (tools.length) body.tools = tools;
  if (reasoning && reasoning !== "off") body.reasoning = { effort: reasoning };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: orHeaders(apiKey, baseUrl),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw orError(res.status, t);
  }
  const json: any = await res.json();
  const msg = json?.choices?.[0]?.message || {};
  return { content: String(msg.content || ""), toolCalls: (msg.tool_calls as ToolCall[]) || [] };
}

// Streaming variant — yields {content} and/or {reasoning} deltas as they arrive. Surfacing the
// reasoning stream lets the UI show the model is THINKING (not frozen) before it starts writing.
export async function* streamOR(opts: {
  model: string;
  messages: ORMessage[];
  apiKey: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  reasoning?: "off" | "high" | "max";
  signal?: AbortSignal;
}): AsyncGenerator<{ content?: string; reasoning?: string; usage?: TokenUsage; finish?: string }> {
  const { model, messages, apiKey, baseUrl = OR, maxTokens = 4000, temperature = 0.3, reasoning, signal } = opts;
  const body: Record<string, unknown> = { model, messages: withPromptCache(messages), max_tokens: maxTokens, temperature, stream: true };
  if (reasoning && reasoning !== "off") body.reasoning = { effort: reasoning };
  // Ask OpenRouter to append a final usage chunk (token counts + real $ cost). Harmless to other
  // OpenAI-compatible servers (they ignore the field); local servers simply won't send it.
  if (/openrouter\.ai/.test(baseUrl)) body.usage = { include: true };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: orHeaders(apiKey, baseUrl),
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw orError(res.status, text);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const IDLE_MS = 90_000; // abort if the model sends NOTHING for 90s (dead connection) — no infinite hang
  while (true) {
    let result: ReadableStreamReadResult<Uint8Array>;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      result = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("idle")), IDLE_MS);
        }),
      ]);
    } catch {
      try { await reader.cancel(); } catch {}
      throw new Error("The model stopped responding (no output for 90s). Try again, lower the Thinking level, or pick another model.");
    } finally {
      clearTimeout(timer);
    }
    const { done, value } = result;
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (data === "[DONE]") return;
      let j: { choices?: { delta?: { content?: string; reasoning?: string }; finish_reason?: string }[]; error?: { message?: string }; usage?: unknown };
      try {
        j = JSON.parse(data);
      } catch {
        continue; // keep-alive / partial frame
      }
      // OpenRouter/provider errors arrive as an in-stream {"error":{...}} frame — surface them clearly
      // (otherwise fable-5 & co. fail silently or with a cryptic "Error in input stream").
      if (j.error) throw new Error(j.error.message || "The model returned a stream error. Try again or a different model.");
      const d = j.choices?.[0]?.delta;
      if (d?.reasoning) yield { reasoning: d.reasoning };
      if (d?.content) yield { content: d.content };
      // finish_reason === "length" means the output was CUT OFF by the token budget → the caller can
      // ask the model to continue so a long file is never left truncated (broken preview).
      const fr = j.choices?.[0]?.finish_reason;
      if (fr) yield { finish: fr };
      // Final usage chunk (token counts + $ cost) — carried on a chunk with an empty choices array.
      if (j.usage) {
        const usage = parseUsage(j.usage);
        if (usage) yield { usage };
      }
    }
  }
}
