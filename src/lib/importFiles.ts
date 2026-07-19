import JSZip from "jszip";
import type { FileMap } from "@/agent/types";

// 🐝 Import arbitrary files / folders / .zip into a project FileMap. Text & code (and SVG, which is
// XML) become real files the agents work on; binary assets (images/media) are NOT inlined — they're
// listed in a manifest so the AI knows the context without reading the binary. .rar is refused
// cleanly (no reliable in-browser decoder). Junk (node_modules, .git, lockfiles…) is filtered out.

export interface BinaryAsset {
  path: string;
  type: string;
  size: number;
}
export interface ImportResult {
  files: FileMap;
  assets: BinaryAsset[];
  skipped: string[];
}

const EXCLUDE_DIR = /(^|\/)(node_modules|\.git|dist|build|out|\.next|\.nuxt|\.svelte-kit|\.cache|\.turbo|\.vercel|coverage|\.idea|\.vscode|__pycache__|venv|\.venv)(\/|$)/i;
const EXCLUDE_FILE = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|\.DS_Store|Thumbs\.db)$/i;
// Executables / installers / disk images — never source, potentially malicious. Refused (never
// inlined, listed as assets, or fetched). Script files (.sh/.ps1…) stay allowed as viewable text.
const DANGEROUS_EXT = /\.(exe|dll|so|dylib|bin|app|msi|deb|rpm|apk|dmg|iso|img|com|scr|pif|cpl|jar)$/i;
const TEXT_EXT =
  /\.(tsx?|jsx?|mjs|cjs|css|scss|sass|less|html?|json5?|jsonc|md|markdown|mdx|txt|py|rb|go|rs|c|h|hpp|cpp|cc|cxx|m|java|kt|kts|scala|swift|dart|php|sh|bash|zsh|fish|ps1|yml|yaml|toml|xml|svg|vue|svelte|astro|graphql|gql|prisma|sql|csv|tsv|ini|conf|cfg|env|properties|gradle|makefile|dockerfile|gitignore|dockerignore|npmrc|editorconfig|prettierrc|eslintrc|babelrc)$/i;

const MAX_TEXT = 1_500_000; // 1.5 MB per text file
const MAX_TOTAL = 16_000_000; // 16 MB total text
const MAX_FILES = 2500;

const relPathOf = (f: File): string =>
  ((f as unknown as { _relPath?: string })._relPath || f.webkitRelativePath || f.name).replace(/^\.?\//, "");

function isTextName(path: string): boolean {
  const base = path.split("/").pop() || path;
  if (TEXT_EXT.test(path)) return true;
  if (!/\.[a-z0-9]+$/i.test(base)) return true; // dotfiles / no-extension configs → treat as text
  return false;
}

function mimeFor(path: string): string {
  const ext = (path.split(".").pop() || "").toLowerCase();
  const m: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
    avif: "image/avif", svg: "image/svg+xml", ico: "image/x-icon", bmp: "image/bmp", tiff: "image/tiff",
    pdf: "application/pdf", mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", wav: "audio/wav",
    woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
  };
  return m[ext] || "application/octet-stream";
}

// Build a stripper that removes the shared leading directory (e.g. "my-project/") common to ALL paths.
function makeStripper(paths: string[]): (p: string) => string {
  const clean = paths.map((p) => p.replace(/^\.?\//, ""));
  if (clean.length < 2) return (p) => p.replace(/^\.?\//, "");
  const parts = clean.map((p) => p.split("/"));
  const first = parts[0];
  let i = 0;
  for (; i < first.length - 1; i++) {
    const seg = first[i];
    if (!parts.every((p) => p.length > i + 1 && p[i] === seg)) break;
  }
  const prefix = first.slice(0, i).join("/");
  const plen = prefix ? prefix.length + 1 : 0;
  return (p) => {
    const c = p.replace(/^\.?\//, "");
    return prefix && c.startsWith(prefix + "/") ? c.slice(plen) : c;
  };
}

async function expandZip(file: File, out: FileMap, assets: BinaryAsset[], skipped: string[], totalRef: { n: number }): Promise<void> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  const strip = makeStripper(names);
  for (const name of names) {
    const entry = zip.files[name];
    const path = strip(name);
    if (!path || EXCLUDE_DIR.test("/" + path) || EXCLUDE_FILE.test(path)) continue;
    if (DANGEROUS_EXT.test(path)) { skipped.push(`${path} (executable/binary refused for safety)`); continue; }
    const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    if (isTextName(path)) {
      if (size > MAX_TEXT) { skipped.push(`${path} (too large)`); continue; }
      if (totalRef.n + size > MAX_TOTAL) { skipped.push(`${path} (total size cap)`); continue; }
      out[path] = await entry.async("string");
      totalRef.n += size;
    } else {
      assets.push({ path, type: mimeFor(path), size });
    }
  }
}

// .rar has no reliable in-browser decoder → decompress it on the server (/api/unrar) and integrate
// the returned entries with the same filters/normalization as .zip.
async function expandRar(file: File, out: FileMap, assets: BinaryAsset[], skipped: string[], totalRef: { n: number }): Promise<void> {
  let data: { entries?: { path: string; size: number; binary: boolean; text?: string }[]; error?: string };
  try {
    const res = await fetch("/api/unrar", { method: "POST", headers: { "content-type": "application/octet-stream" }, body: await file.arrayBuffer() });
    data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    if (!res.ok) { skipped.push(`${file.name} (.rar: ${data.error || res.status})`); return; }
  } catch (e) {
    skipped.push(`${file.name} (.rar: ${e instanceof Error ? e.message : "unreadable"})`);
    return;
  }
  if (data.error || !data.entries) { skipped.push(`${file.name} (.rar: ${data.error || "no entries"})`); return; }
  const strip = makeStripper(data.entries.map((e) => e.path));
  for (const e of data.entries) {
    const path = strip(e.path);
    if (!path || EXCLUDE_DIR.test("/" + path) || EXCLUDE_FILE.test(path)) continue;
    if (!e.binary && typeof e.text === "string") {
      if (e.size > MAX_TEXT) { skipped.push(`${path} (too large)`); continue; }
      if (totalRef.n + (e.size || 0) > MAX_TOTAL) { skipped.push(`${path} (total size cap)`); continue; }
      out[path] = e.text;
      totalRef.n += e.size || 0;
    } else {
      assets.push({ path, type: mimeFor(path), size: e.size || 0 });
    }
  }
}

// Turn a flat list of File objects (from an <input>, a folder input, or a drag-drop walk) into a
// project FileMap + a binary-asset manifest.
export async function buildImport(fileList: File[]): Promise<ImportResult> {
  const files: FileMap = {};
  const assets: BinaryAsset[] = [];
  const skipped: string[] = [];
  const totalRef = { n: 0 };
  const strip = makeStripper(fileList.map(relPathOf));

  for (const f of fileList) {
    if (Object.keys(files).length > MAX_FILES) { skipped.push("… (file count cap reached)"); break; }
    const path = strip(relPathOf(f));
    if (!path || EXCLUDE_DIR.test("/" + path) || EXCLUDE_FILE.test(path)) continue;
    if (DANGEROUS_EXT.test(path)) { skipped.push(`${path} (executable/binary refused for safety)`); continue; }
    const lower = path.toLowerCase();

    if (lower.endsWith(".zip")) {
      try { await expandZip(f, files, assets, skipped, totalRef); }
      catch { skipped.push(`${path} (zip read failed)`); }
      continue;
    }
    if (lower.endsWith(".rar")) {
      try { await expandRar(f, files, assets, skipped, totalRef); }
      catch { skipped.push(`${path} (rar read failed)`); }
      continue;
    }
    if (isTextName(path)) {
      if (f.size > MAX_TEXT) { skipped.push(`${path} (too large)`); continue; }
      if (totalRef.n + f.size > MAX_TOTAL) { skipped.push(`${path} (total size cap)`); continue; }
      try { files[path] = await f.text(); totalRef.n += f.size; }
      catch { skipped.push(`${path} (unreadable)`); }
    } else {
      assets.push({ path, type: mimeFor(path), size: f.size });
    }
  }

  addManifest(files, assets);
  return { files, assets, skipped };
}

const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1_048_576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1_048_576).toFixed(1)} MB`);

// A text manifest of the binary assets so the AGENTS have context (path/type/size) without reading
// the binary. Included in the FileMap → part of `summariseFiles` sent to the models.
function addManifest(files: FileMap, assets: BinaryAsset[]): void {
  if (!assets.length) return;
  const lines = assets.sort((a, b) => a.path.localeCompare(b.path)).map((a) => `- \`${a.path}\` — ${a.type}, ${fmtSize(a.size)}`);
  files["IMPORTED_ASSETS.md"] =
    "# Imported binary assets\n\n" +
    "These files were imported with the project but are binary (images / media / fonts) so their " +
    "content is NOT inlined here. Reference them by their path when needed.\n\n" +
    lines.join("\n") +
    "\n";
}

// ── Sources ─────────────────────────────────────────────────────────────────────────────────────

// From an <input type="file"> (multiple or webkitdirectory). Preserves folder paths.
export function filesFromInput(input: HTMLInputElement): File[] {
  return Array.from(input.files || []);
}

// From a drag-and-drop DataTransfer — walks dropped folders recursively via webkitGetAsEntry.
export async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const items = dt.items;
  const roots: FileSystemEntry[] = [];
  const loose: File[] = [];
  if (items && items.length) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i] as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null };
      const entry = it.webkitGetAsEntry?.();
      if (entry) roots.push(entry);
      else { const f = it.getAsFile?.(); if (f) loose.push(f); }
    }
  }
  if (!roots.length) return loose.length ? loose : Array.from(dt.files || []);
  const out: File[] = [...loose];
  for (const e of roots) await walkEntry(e, out);
  return out;
}

function walkEntry(entry: FileSystemEntry, out: File[]): Promise<void> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file(
        (f: File) => {
          try { Object.defineProperty(f, "_relPath", { value: entry.fullPath.replace(/^\//, "") }); } catch {}
          out.push(f);
          resolve();
        },
        () => resolve(),
      );
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const all: FileSystemEntry[] = [];
      const readBatch = () =>
        reader.readEntries(
          async (batch: FileSystemEntry[]) => {
            if (!batch.length) {
              for (const c of all) await walkEntry(c, out);
              resolve();
            } else {
              all.push(...batch);
              readBatch();
            }
          },
          () => resolve(),
        );
      readBatch();
    } else resolve();
  });
}

// Pick a sensible entry file to open after import.
export function pickEntry(files: FileMap): string | null {
  const keys = Object.keys(files);
  const pref = [/(^|\/)index\.html?$/i, /(^|\/)App\.(t|j)sx?$/, /(^|\/)src\/main\.(t|j)sx?$/, /(^|\/)main\.(t|j)sx?$/, /(^|\/)README\.md$/i];
  for (const re of pref) {
    const hit = keys.find((k) => re.test(k));
    if (hit) return hit;
  }
  return keys[0] || null;
}
