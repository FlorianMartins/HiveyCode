"use client";

// Full appearance customization for HiveyCode. Every knob maps to ONE CSS variable in globals.css,
// is persisted in localStorage, and applied on load. The *accent* colour is NOT here — it lives in the
// store (`setAccent`) because it's synced with the sidebar; everything else lives here.
export interface UiPrefs {
  bg: string; // --bg (near-black base)
  accent2: string; // --accent-2 (second gradient stop; accent itself is the store's)
  surfaceColor: string; // base rgb of panels/tool/elevated
  surfaceAlpha: number; // opacity of the surfaces (kept lighter than bg for depth)
  borderColor: string; // base rgb of borders
  borderAlpha: number; // strength of borders
  text: string; // --text
  muted: string; // --muted
  auraColor: string; // background glow colour
  auraSize: number; // glow radius (px)
  auraOpacity: number; // glow opacity
}

export const DEFAULT_UI: UiPrefs = {
  bg: "#09090b",
  accent2: "#8b5cf6",
  surfaceColor: "#18181c",
  surfaceAlpha: 0.9,
  borderColor: "#ffffff",
  borderAlpha: 0.1,
  text: "#f4f2fc",
  muted: "#9b98ad",
  auraColor: "#6366f1",
  auraSize: 950,
  auraOpacity: 0.15,
};

const KEY = "hivey.ui.theme";

// "#18181c" → "24, 24, 28" for use inside rgba(var(--x), <alpha>).
function hexToRgbTriplet(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "24, 24, 28";
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

export function loadUi(): UiPrefs {
  if (typeof window === "undefined") return DEFAULT_UI;
  try {
    return { ...DEFAULT_UI, ...(JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<UiPrefs>) };
  } catch {
    return DEFAULT_UI;
  }
}

export function saveUi(p: UiPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

export function applyUi(p: UiPrefs) {
  if (typeof document === "undefined") return;
  const r = document.documentElement.style;
  r.setProperty("--bg", p.bg);
  r.setProperty("--accent-2", p.accent2);
  r.setProperty("--surface-rgb", hexToRgbTriplet(p.surfaceColor));
  r.setProperty("--surface-alpha", String(p.surfaceAlpha));
  r.setProperty("--border-rgb", hexToRgbTriplet(p.borderColor));
  r.setProperty("--border-alpha", String(p.borderAlpha));
  r.setProperty("--text", p.text);
  r.setProperty("--muted", p.muted);
  r.setProperty("--aura-color", p.auraColor);
  r.setProperty("--aura-2", p.accent2);
  r.setProperty("--aura-size", p.auraSize + "px");
  r.setProperty("--aura-opacity", String(p.auraOpacity));
}
