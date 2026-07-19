// Multi-provider BYOK — like the sidebar. Every provider here exposes an OpenAI-compatible
// /chat/completions + /models endpoint, so the same code path works for all of them; only the base
// URL and the key change. (Anthropic has no OpenAI-compatible endpoint → its models are reached
// through OpenRouter, which proxies them.)
export interface ProviderDef {
  id: string;
  label: string;
  baseUrl: string;
  keyHint: string;
  models?: string; // optional /models override (else `${baseUrl}/models`)
}

export const PROVIDERS: ProviderDef[] = [
  { id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", keyHint: "sk-or-v1-…" },
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", keyHint: "sk-…" },
  { id: "google", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", keyHint: "AIza…", models: "https://generativelanguage.googleapis.com/v1beta/openai/models" },
  { id: "groq", label: "Groq", baseUrl: "https://api.groq.com/openai/v1", keyHint: "gsk_…" },
  { id: "mistral", label: "Mistral", baseUrl: "https://api.mistral.ai/v1", keyHint: "…" },
  { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", keyHint: "sk-…" },
  { id: "xai", label: "xAI (Grok)", baseUrl: "https://api.x.ai/v1", keyHint: "xai-…" },
];

// Local (offline) OpenAI-compatible servers. No key. The base URL is the DEFAULT — the
// user can override it in Settings. NOTE: HiveyCode makes LLM calls server-side, so on the
// hosted app (app.hivey.be) "localhost" is the *server's* localhost, not the user's machine.
// Local models therefore only work when HiveyCode runs on the same machine as Ollama/LM Studio
// (the "Run locally" / self-host flow). The UI surfaces this.
export const LOCAL_PROVIDERS: ProviderDef[] = [
  { id: "ollama", label: "Local · Ollama", baseUrl: "http://localhost:11434/v1", keyHint: "no key needed" },
  { id: "lmstudio", label: "Local · LM Studio", baseUrl: "http://localhost:1234/v1", keyHint: "no key needed" },
  { id: "custom", label: "Local · Custom (OpenAI-compatible)", baseUrl: "", keyHint: "no key needed" },
];

export const LOCAL_IDS = new Set(LOCAL_PROVIDERS.map((p) => p.id));

export const PROVIDER_BY_ID: Record<string, ProviderDef> = Object.fromEntries(
  [...PROVIDERS, ...LOCAL_PROVIDERS].map((p) => [p.id, p]),
);

// Resolve a selected model + the user's keys into a concrete call target.
// - "hivey/*"            → OpenRouter, Hivey routing (handled by the caller).
// - "provider|modelId"   → that provider's base URL + key.
// - bare "vendor/model"  → OpenRouter (its catalog id).
export function resolveTarget(
  variant: string,
  keys: Record<string, string>,
  localBaseUrls?: Record<string, string>,
): { hivey: boolean; provider: string; baseUrl: string; apiKey: string; model: string } {
  const orKey = keys.openrouter || "";
  // Any Hivey pseudo-model — "hivey/free", "hivey/smart" AND the bare "hivey" (hybrid) — is
  // routed per-role by the caller (modelFor). Without the bare-"hivey" case the literal string
  // "hivey" was sent to OpenRouter → 400 "hivey is not a valid model ID".
  if (variant === "hivey" || variant.startsWith("hivey/")) {
    return { hivey: true, provider: "openrouter", baseUrl: PROVIDER_BY_ID.openrouter.baseUrl, apiKey: orKey, model: variant };
  }
  if (variant.includes("|")) {
    const [prov, ...rest] = variant.split("|");
    const def = PROVIDER_BY_ID[prov] || PROVIDER_BY_ID.openrouter;
    // Local server: use the user's configured base URL (or the default) and NO key.
    if (LOCAL_IDS.has(def.id)) {
      const baseUrl = (localBaseUrls && localBaseUrls[def.id]) || def.baseUrl;
      return { hivey: false, provider: def.id, baseUrl, apiKey: "", model: rest.join("|") };
    }
    return { hivey: false, provider: def.id, baseUrl: def.baseUrl, apiKey: keys[def.id] || orKey, model: rest.join("|") };
  }
  return { hivey: false, provider: "openrouter", baseUrl: PROVIDER_BY_ID.openrouter.baseUrl, apiKey: orKey, model: variant };
}
