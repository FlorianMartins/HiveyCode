// Full theme sync from the Hivey sidebar. The sidebar's content-script bridge posts its RESOLVED
// palette; we map each sidebar colour key to the matching HiveyCode CSS variable and persist it so it
// survives a reload (re-applied in the store's hydrate()).
export type SidebarPalette = Partial<
  Record<"bg" | "panel" | "panel2" | "border" | "borderSoft" | "text" | "muted" | "accent" | "accent2", string>
>;

// sidebar key → HiveyCode CSS variable (globals.css).
const VAR_MAP: Record<string, string> = {
  bg: "--bg",
  panel: "--panel",
  panel2: "--tool",
  border: "--border",
  borderSoft: "--border-soft",
  text: "--text",
  muted: "--muted",
  accent: "--accent",
  accent2: "--accent-2",
};

const STORAGE_KEY = "hivey.themePalette";

export function applyThemePalette(p: SidebarPalette | null | undefined): void {
  if (typeof document === "undefined" || !p) return;
  const root = document.documentElement.style;
  for (const [key, cssVar] of Object.entries(VAR_MAP)) {
    const v = (p as Record<string, string | undefined>)[key];
    if (typeof v === "string" && v) root.setProperty(cssVar, v);
  }
}

export function saveThemePalette(p: SidebarPalette): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {}
}

export function loadSavedPalette(): SidebarPalette | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SidebarPalette) : null;
  } catch {
    return null;
  }
}
