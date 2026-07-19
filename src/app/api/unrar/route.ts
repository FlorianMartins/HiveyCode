import { createExtractorFromData } from "node-unrar-js";

export const runtime = "nodejs";
export const maxDuration = 60;

// Decompress a .rar in the Node process (the browser has no reliable RAR decoder). Returns the
// entries so the client integrates them with the same filters/normalization as .zip. The archive is
// only DECOMPRESSED (never executed); size is capped to avoid abuse.
const TEXT_EXT =
  /\.(tsx?|jsx?|mjs|cjs|css|scss|sass|less|html?|json5?|jsonc|md|markdown|mdx|txt|py|rb|go|rs|c|h|hpp|cpp|cc|cxx|m|java|kt|kts|scala|swift|dart|php|sh|bash|zsh|fish|ps1|yml|yaml|toml|xml|svg|vue|svelte|astro|graphql|gql|prisma|sql|csv|tsv|ini|conf|cfg|env|properties|gradle|makefile|dockerfile|gitignore|dockerignore|npmrc|editorconfig|prettierrc|eslintrc|babelrc)$/i;
const MAX_TEXT = 1_500_000;
const MAX_ARCHIVE = 80_000_000; // 80 MB

const isTextName = (path: string) => {
  const base = path.split("/").pop() || path;
  return TEXT_EXT.test(path) || !/\.[a-z0-9]+$/i.test(base);
};

export async function POST(req: Request) {
  try {
    const buf = await req.arrayBuffer();
    if (!buf.byteLength) return Response.json({ error: "empty archive" }, { status: 400 });
    if (buf.byteLength > MAX_ARCHIVE) return Response.json({ error: "archive too large (>80MB)" }, { status: 413 });

    const extractor = await createExtractorFromData({ data: buf });
    const extracted = extractor.extract();

    const entries: { path: string; size: number; binary: boolean; text?: string }[] = [];
    for (const file of extracted.files) {
      const h = file.fileHeader;
      if (h.flags.directory) continue;
      const path = h.name.replace(/\\/g, "/");
      const size = h.unpSize || file.extraction?.length || 0;
      if (isTextName(path) && file.extraction && size <= MAX_TEXT) {
        entries.push({ path, size, binary: false, text: new TextDecoder("utf-8", { fatal: false }).decode(file.extraction) });
      } else {
        entries.push({ path, size, binary: true });
      }
    }
    return Response.json({ entries });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
