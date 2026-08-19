"use client";

import type { DesignDirection } from "@/agent/types";
import { designToRequirements } from "@/agent/design";
import { Sparkles } from "lucide-react";

export function designStyle(name: string) {
  const n = name.toLowerCase();
  if (n.includes("glass")) return { bg: "linear-gradient(135deg,#1e1b3a,#0b0b13)", card: "rgba(139,92,246,.20)", border: "rgba(255,255,255,.16)", accent: "#8b5cf6", radius: 10, blur: true };
  if (n.includes("minimal") || n.includes("linear")) return { bg: "#0f1016", card: "#181a24", border: "rgba(255,255,255,.08)", accent: "#6366f1", radius: 8 };
  if (n.includes("playful")) return { bg: "#fff7ed", card: "#fde68a", border: "#fb923c", accent: "#f97316", radius: 14 };
  if (n.includes("corporate")) return { bg: "#f8fafc", card: "#e2e8f0", border: "#cbd5e1", accent: "#2563eb", radius: 4 };
  if (n.includes("brutal")) return { bg: "#f5f5f5", card: "#ffffff", border: "#000000", accent: "#000000", radius: 0 };
  if (n.includes("neumorph")) return { bg: "#e0e5ec", card: "#e0e5ec", border: "rgba(0,0,0,.05)", accent: "#6d5dfc", radius: 12, soft: true };
  if (n.includes("editorial")) return { bg: "#faf7f2", card: "#ffffff", border: "#e7e0d5", accent: "#111111", radius: 2 };
  if (n.includes("retro") || n.includes("80")) return { bg: "linear-gradient(135deg,#2b1055,#5b7fd4)", card: "rgba(255,43,214,.28)", border: "#00e5ff", accent: "#ff2bd6", radius: 6 };
  if (n.includes("gradient") || n.includes("vibrant")) return { bg: "linear-gradient(135deg,#6366f1,#ec4899)", card: "rgba(255,255,255,.24)", border: "rgba(255,255,255,.35)", accent: "#ffffff", radius: 12 };
  if (n.includes("mono")) return { bg: "#111111", card: "#2a2a2a", border: "#444444", accent: "#bbbbbb", radius: 6 };
  return { bg: "#0f1016", card: "#181a24", border: "rgba(255,255,255,.08)", accent: "#6366f1", radius: 8 };
}
export function DesignThumb({ name }: { name: string }) {
  const s = designStyle(name);
  const cardR = Math.max(2, s.radius - 3);
  return (
    <div style={{ background: s.bg, borderRadius: s.radius, height: 44, padding: 5, display: "flex", flexDirection: "column", gap: 4, overflow: "hidden", ...(s.blur ? { backdropFilter: "blur(4px)" } : {}) }}>
      <div style={{ height: 6, width: "55%", borderRadius: 3, background: s.accent }} />
      <div style={{ display: "flex", gap: 4, flex: 1 }}>
        <div style={{ flex: 1, background: s.card, border: `1px solid ${s.border}`, borderRadius: cardR, boxShadow: s.soft ? "2px 2px 4px rgba(0,0,0,.12), -2px -2px 4px rgba(255,255,255,.6)" : undefined }} />
        <div style={{ flex: 1, background: s.card, border: `1px solid ${s.border}`, borderRadius: cardR }} />
      </div>
    </div>
  );
}

// The user's interview answers ("My choices"), rendered as a clean card instead of a raw bulleted
// blob: a header + one row per question (the question in muted small text, the chosen answer bold).
export function ChoicesCard({ content }: { content: string }) {
  const rows = content
    .replace(/^My choices:\s*/i, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf("→");
      return i >= 0 ? { q: l.slice(0, i).trim(), a: l.slice(i + 1).trim() } : { q: "", a: l };
    });
  return (
    <div className="ml-auto w-fit max-w-[88%] rounded-2xl rounded-br-sm border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-panel/70 px-4 py-3 text-sm backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-accent">
        <Sparkles size={13} /> My choices
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {r.q && <div className="text-[11px] leading-snug text-muted">{r.q}</div>}
            <div className="font-medium leading-snug text-text">{r.a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Guided (Hivey Smart) mode: clickable options (design directions shown as visual thumbnails), plus
// MULTIPLE custom answers per question (a "+" list). The user picks/adds, then builds — or lets Smart decide.
// Design checkpoint. The mockup is rendered LOCALLY from the returned tokens — that is what makes
// showing three directions cheap enough to be worth doing before the build.
export function DesignPanel({
  directions,
  onPick,
}: {
  directions: DesignDirection[];
  onPick: (requirements: string, label: string) => void;
}) {
  const pad = (d: DesignDirection) => (d.density === "compact" ? 8 : d.density === "airy" ? 16 : 12);
  return (
    <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {directions.map((d) => (
        <div key={d.id} className="min-w-0 overflow-hidden rounded-xl border border-border">
          {/* Miniature of the real thing: background, surface, text, muted, accent, radius, fonts. */}
          <div style={{ background: d.bg, padding: pad(d), fontFamily: d.font }} aria-hidden>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: pad(d) }}>
              <div style={{ width: 10, height: 10, borderRadius: d.radius / 3, background: d.accent }} />
              <div
                style={{ color: d.text, fontFamily: d.headingFont, fontSize: 11, fontWeight: 600 }}
                className="truncate"
              >
                {d.name}
              </div>
            </div>
            <div style={{ background: d.surface, borderRadius: d.radius, padding: pad(d) }}>
              <div style={{ color: d.text, fontSize: 10, fontWeight: 600, marginBottom: 3 }}>Revenue</div>
              <div style={{ color: d.muted, fontSize: 9, marginBottom: pad(d) }}>+12.4% this month</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 26, marginBottom: pad(d) }}>
                {[40, 70, 45, 90, 60].map((h, k) => (
                  <div
                    key={k}
                    style={{
                      flex: 1,
                      height: `${h}%`,
                      background: d.accent,
                      borderRadius: Math.min(3, d.radius / 4),
                      opacity: 0.55 + k * 0.09,
                      transformOrigin: "bottom",
                      // The card demonstrates its own motion setting instead of merely naming it.
                      animation:
                        d.motion === "minimal"
                          ? undefined
                          : `hcRise ${d.motion === "lively" ? 320 : 220}ms ease-out ${k * (d.motion === "lively" ? 50 : 35)}ms both`,
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  background: d.accent,
                  color: d.accentText,
                  borderRadius: d.radius / 1.5,
                  fontSize: 9,
                  fontWeight: 600,
                  padding: "4px 8px",
                  textAlign: "center",
                }}
              >
                View report
              </div>
            </div>
          </div>
          <div className="bg-surface/60 p-2.5">
            <p className="text-xs leading-snug text-muted">{d.personality}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">
                {d.density}
              </span>
              <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">
                motion: {d.motion}
              </span>
              <span className="min-w-0 truncate text-[10px] text-muted">{d.headingFont}</span>
            </div>
            <button
              onClick={() => onPick(designToRequirements(d), d.name)}
              className="mt-2 w-full shrink-0 rounded-lg bg-accent px-2 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              Use {d.name}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// The cost gate. Shown BEFORE any code is generated, so declining costs the user nothing.
