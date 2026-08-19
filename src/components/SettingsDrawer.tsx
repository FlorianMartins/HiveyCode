"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import { PROVIDERS, LOCAL_PROVIDERS } from "@/agent/providers";
import { loadUi, saveUi, applyUi, DEFAULT_UI, type UiPrefs } from "@/lib/uiTheme";
import { useT } from "@/lib/i18n";
import { X, Palette, ExternalLink, RefreshCw, KeyRound, Check, RotateCcw, HardDrive } from "lucide-react";
import { HiveLogo } from "./HiveLogo";

const PRESETS = [
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Honey", hex: "#d97706" },
  { name: "Teal", hex: "#0d9488" },
  { name: "Cyan", hex: "#06b6d4" },
  { name: "Rose", hex: "#e11d48" },
  { name: "Blue", hex: "#3b82f6" },
];

export function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { accent, setAccent, fetchModels, orModels, apiKey, setApiKey, keys, setProviderKey, localBaseUrls, localEnabled, setLocalServer } = useStore();
  const isLocalhost = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  const t = useT();
  const [keyDraft, setKeyDraft] = useState(apiKey);
  const [saved, setSaved] = useState(false);
  const [ui, setUi] = useState<UiPrefs>(() => loadUi());
  // The sidebar bridge flags its presence on <html> at document_start → show "Open all settings" only
  // when the extension is installed.
  const [hasBridge, setHasBridge] = useState(false);
  useEffect(() => {
    const check = () => setHasBridge(typeof document !== "undefined" && document.documentElement.dataset.hiveyBridge === "1");
    check();
    const t = setTimeout(check, 400); // in case the drawer opened before the bridge flagged
    return () => clearTimeout(t);
  }, [open]);

  const updateUi = (patch: Partial<UiPrefs>) => {
    const next = { ...ui, ...patch };
    setUi(next);
    applyUi(next);
    saveUi(next);
  };

  if (!open) return null;

  const openSidebarSettings = () => {
    try {
      window.postMessage({ source: "hivey-app", action: "open-settings" }, "*");
    } catch {}
  };
  const saveKey = () => {
    setApiKey(keyDraft.trim());
    fetchModels();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-panel/90 shadow-glow backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ambient glow */}
        <div className="pointer-events-none absolute -top-24 left-1/3 h-56 w-72 rounded-full bg-accent/20 blur-[100px]" />

        <div className="relative flex items-center gap-3 border-b border-border px-5 h-14">
          <HiveLogo size={22} />
          <span className="font-semibold">Settings</span>
          <button onClick={onClose} className="ml-auto text-muted hover:text-text" title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto p-5 space-y-7">
          {/* Quick settings live here; the FULL settings page is the sidebar's options page. */}
          {hasBridge ? (
            <button
              onClick={openSidebarSettings}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-accent/40 bg-hivey-grad-soft px-4 py-3 text-left transition-colors hover:border-accent"
            >
              <span>
                <span className="block text-sm font-medium text-text">Open all settings ↗</span>
                <span className="block text-[11px] text-muted">Theme, providers, appearance… — the full Hivey settings page</span>
              </span>
              <ExternalLink size={16} className="shrink-0 text-accent" />
            </button>
          ) : (
            <div className="rounded-xl border border-border bg-tool/50 px-4 py-3 text-[11px] text-muted">
              Install the Hivey sidebar extension for the full settings page (theme sync, all providers…).
            </div>
          )}
          {/* API key */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
              <KeyRound size={13} /> OpenRouter key
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                placeholder="sk-or-v1-…"
                className="flex-1 rounded-lg border border-border bg-tool px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <button onClick={saveKey} className="flex items-center gap-1.5 rounded-lg bg-hivey-grad px-3 py-2 text-sm font-medium text-on-accent">
                {saved ? <Check size={15} /> : "Save"}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted">Stored only in your browser. One key unlocks every model (Anthropic, OpenAI, Google…).</p>
          </section>

          {/* Provider keys (like the sidebar) — use your own Anthropic/OpenAI/Google/… keys */}
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Provider keys (optional)</h3>
            <p className="mb-2 text-[11px] text-muted">Add a provider&apos;s own key to use its models directly. Synced from the Hivey sidebar.</p>
            <div className="space-y-2">
              {PROVIDERS.filter((p) => p.id !== "openrouter").map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted">{p.label}</span>
                  <input
                    type="password"
                    value={keys[p.id] || ""}
                    onChange={(e) => setProviderKey(p.id, e.target.value.trim())}
                    placeholder={p.keyHint}
                    className="flex-1 rounded-lg border border-border bg-tool px-3 py-1.5 text-xs outline-none focus:border-accent"
                  />
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted">Anthropic models are available through OpenRouter.</p>
          </section>

          {/* Local models (offline) — Ollama / LM Studio / custom OpenAI-compatible server. No key.
              The agent RUNS server-side, so on the hosted app the model must be reachable from the
              server: this only works when you run HiveyCode on the same machine (the "Run locally"
              flow). The picker can still list your local models (listed from the browser). */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
              <HardDrive size={13} /> Local models (offline)
            </h3>
            {!isLocalhost && (
              <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-300/90">
                ⚠️ Running local models needs HiveyCode on the same machine as Ollama/LM Studio (agent runs server-side).
                Use the <b>Run locally</b> flow, or the sidebar for browser-side local models.
              </p>
            )}
            <div className="space-y-2.5">
              {LOCAL_PROVIDERS.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <label className="flex w-32 shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={!!localEnabled[p.id]}
                      onChange={(e) => setLocalServer(p.id, { enabled: e.target.checked })}
                      className="accent-accent"
                    />
                    {p.label.replace("Local · ", "")}
                  </label>
                  <input
                    type="text"
                    value={localBaseUrls[p.id] || ""}
                    onChange={(e) => setLocalServer(p.id, { baseUrl: e.target.value.trim() })}
                    placeholder={p.baseUrl || "http://localhost:8000/v1"}
                    className="flex-1 rounded-lg border border-border bg-tool px-3 py-1.5 text-xs outline-none focus:border-accent"
                  />
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted">
              Enable a server → its installed models appear in the picker (grouped “Local”). Ollama: run with{" "}
              <code className="rounded bg-tool px-1">OLLAMA_ORIGINS=*</code> so the browser can list them.
            </p>
          </section>

          {/* Appearance — full theme customization (colours, surfaces, borders, aura). Every control
              drives a CSS variable live; persisted, and the accent is synced with the sidebar. */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
              <Palette size={13} /> {t("settings.appearance")}
              <button
                onClick={() => {
                  updateUi(DEFAULT_UI);
                  setAccent("#6366f1");
                }}
                title="Reset appearance to defaults"
                className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] normal-case text-muted transition-colors hover:border-accent hover:text-text"
              >
                <RotateCcw size={11} /> {t("settings.reset")}
              </button>
            </h3>

            {/* Live preview — built from the theme variables, so it updates as you tweak. */}
            <div className="mb-4 rounded-xl border border-border bg-panel p-3">
              <div className="mb-2 h-2 w-24 rounded-full bg-hivey-grad" />
              <div className="flex items-stretch gap-2">
                <div className="flex-1 rounded-lg border border-border bg-tool p-2">
                  <div className="text-[12px] text-text">Aa Sample surface</div>
                  <div className="text-[11px] text-muted">Muted text on a panel</div>
                </div>
                {/* A colour SAMPLE, not a control. As a <button> it took a keyboard tab stop and did
                    nothing when activated — a focusable dead end for anyone not using a mouse. */}
                <div aria-hidden="true" className="flex items-center rounded-lg bg-hivey-grad px-3 text-[12px] font-medium text-on-accent">Accent</div>
              </div>
            </div>

            <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">{t("settings.colours")}</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.hex}
                  onClick={() => setAccent(p.hex)}
                  title={p.name}
                  className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${accent.toLowerCase() === p.hex.toLowerCase() ? "border-text" : "border-transparent"}`}
                  style={{ background: p.hex }}
                />
              ))}
            </div>
            <div className="space-y-3">
              <ColorRow label="Accent" value={accent} onChange={setAccent} />
              <ColorRow label="Accent 2" value={ui.accent2} onChange={(v) => updateUi({ accent2: v })} />
              <ColorRow label="Background" value={ui.bg} onChange={(v) => updateUi({ bg: v })} />
              <ColorRow label="Surfaces" value={ui.surfaceColor} onChange={(v) => updateUi({ surfaceColor: v })} />
              <ColorRow label="Borders" value={ui.borderColor} onChange={(v) => updateUi({ borderColor: v })} />
              <ColorRow label="Text" value={ui.text} onChange={(v) => updateUi({ text: v })} />
              <ColorRow label="Muted text" value={ui.muted} onChange={(v) => updateUi({ muted: v })} />
            </div>

            <p className="mb-1.5 mt-4 text-[11px] uppercase tracking-wide text-muted">{t("settings.surfaces")}</p>
            <div className="space-y-3">
              <SliderRow label="Surface opacity" value={ui.surfaceAlpha} min={0.4} max={1} step={0.02} onChange={(v) => updateUi({ surfaceAlpha: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
              <SliderRow label="Border strength" value={ui.borderAlpha} min={0.02} max={0.35} step={0.01} onChange={(v) => updateUi({ borderAlpha: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
            </div>

            <p className="mb-1.5 mt-4 text-[11px] uppercase tracking-wide text-muted">{t("settings.aura")}</p>
            <div className="space-y-3">
              <ColorRow label="Aura colour" value={ui.auraColor} onChange={(v) => updateUi({ auraColor: v })} />
              <SliderRow label="Aura size" value={ui.auraSize} min={300} max={1400} step={20} onChange={(v) => updateUi({ auraSize: v })} fmt={(v) => `${v}px`} />
              <SliderRow label="Aura opacity" value={ui.auraOpacity} min={0} max={0.4} step={0.01} onChange={(v) => updateUi({ auraOpacity: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
            </div>
          </section>

          {/* Sidebar */}
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Hivey sidebar</h3>
            <button
              onClick={openSidebarSettings}
              className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm text-text transition-colors hover:border-accent"
            >
              <ExternalLink size={14} /> Open sidebar settings
              <span className="ml-auto text-[11px] text-muted">requires the extension</span>
            </button>
          </section>

          {/* Models */}
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Models</h3>
            <button
              onClick={() => fetchModels()}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm text-text transition-colors hover:border-accent"
            >
              <RefreshCw size={14} /> Refresh model list
              <span className="ml-auto text-[11px] text-muted">{orModels.length} available</span>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-muted">{label}</span>
      <label className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-border" style={{ background: value }} title="Pick colour">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-0 w-0 opacity-0" />
      </label>
      <span className="font-mono text-[11px] text-muted">{value}</span>
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-muted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-tool accent-[var(--accent)]"
      />
      <span className="w-12 shrink-0 text-right font-mono text-[11px] text-muted">{fmt(value)}</span>
    </div>
  );
}
