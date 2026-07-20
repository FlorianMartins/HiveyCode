// 🐝 Design checkpoint — let the user SEE the design before paying for the build.
//
// The interview already asks which style they want, but it asks by NAME ("Glassy dark", "Editorial").
// A name is not a look: two people picture different things, and the mismatch only becomes visible
// once the app is generated and paid for. This module turns the name into concrete tokens the UI can
// render immediately, so the choice happens before the coder ever runs.
//
// The model returns tokens, never markup. Three directions therefore cost ONE small JSON call rather
// than three generated mockups — the whole point is that looking is cheap.

import type { DesignDirection } from "./types";

// ── Contrast ─────────────────────────────────────────────────────────────────────────────────────
// A model will happily return an elegant palette whose body text is unreadable on its background.
// We check WCAG relative luminance ourselves rather than trusting the prompt: this is arithmetic,
// so there is no reason to delegate it.

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return 0;
  const la = luminance(ra);
  const lb = luminance(rb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const isHex = (v: unknown): v is string => typeof v === "string" && /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());
const norm = (v: string) => (v.trim().startsWith("#") ? v.trim() : `#${v.trim()}`);

// ── Parsing ──────────────────────────────────────────────────────────────────────────────────────
// Rejects a direction outright rather than shipping a broken palette: a direction with unreadable
// text is worse than one fewer option, because the user might pick it.
export function parseDirections(raw: string): DesignDirection[] {
  const m = /\{[\s\S]*\}/.exec(raw);
  if (!m) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(m[0]);
  } catch {
    return [];
  }
  const list = (parsed as { directions?: unknown }).directions;
  if (!Array.isArray(list)) return [];

  const out: DesignDirection[] = [];
  for (const item of list) {
    const o = item as Record<string, unknown>;
    const cols = ["bg", "surface", "text", "muted", "accent", "accentText"] as const;
    if (!cols.every((k) => isHex(o[k]))) continue;

    const bg = norm(o.bg as string);
    const text = norm(o.text as string);
    const accent = norm(o.accent as string);
    const accentText = norm(o.accentText as string);

    // Body text must be readable on the background, and a label readable on the accent. AA for body
    // (4.5:1); 3:1 for the accent chip, which is large/bold UI text in the preview.
    if (contrastRatio(text, bg) < 4.5) continue;
    if (contrastRatio(accentText, accent) < 3) continue;

    const density = o.density === "compact" || o.density === "airy" ? o.density : "regular";
    const radiusRaw = Number(o.radius);
    out.push({
      id: String(o.id ?? out.length + 1).slice(0, 8) || String(out.length + 1),
      name: String(o.name ?? "Direction").slice(0, 40),
      personality: String(o.personality ?? "").slice(0, 200),
      bg,
      surface: norm(o.surface as string),
      text,
      muted: norm(o.muted as string),
      accent,
      accentText,
      font: String(o.font ?? "Inter").slice(0, 60),
      headingFont: String(o.headingFont ?? o.font ?? "Inter").slice(0, 60),
      radius: Number.isFinite(radiusRaw) ? Math.min(32, Math.max(0, Math.round(radiusRaw))) : 12,
      density,
    });
    if (out.length === 3) break;
  }
  return out;
}

// ── Handing the choice to the coder ──────────────────────────────────────────────────────────────
// Serialised as an explicit, non-negotiable spec. The coder is otherwise very willing to drift back
// to its own defaults, which would make the whole checkpoint pointless.
export function designToRequirements(d: DesignDirection): string {
  return (
    `=== DESIGN DIRECTION (chosen by the user — NON-NEGOTIABLE) ===\n` +
    `Name: ${d.name} — ${d.personality}\n` +
    `Use EXACTLY these design tokens across every file. Define them once (CSS variables or a Tailwind ` +
    `theme) and reference them; never hardcode a different colour, and never fall back to default ` +
    `Tailwind greys/blues.\n` +
    `• background: ${d.bg}\n` +
    `• surface/cards: ${d.surface}\n` +
    `• body text: ${d.text}\n` +
    `• muted/secondary text: ${d.muted}\n` +
    `• accent (primary actions): ${d.accent}\n` +
    `• text on accent: ${d.accentText}\n` +
    `• corner radius: ${d.radius}px, applied consistently\n` +
    `• body font: ${d.font}; headings: ${d.headingFont} (load them, don't assume availability)\n` +
    `• density: ${d.density}\n` +
    `The finished app MUST look like this direction at a glance. Every surface, button, input and ` +
    `border derives from these tokens.`
  );
}
