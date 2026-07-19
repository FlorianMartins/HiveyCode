import type { FileMap } from "@/agent/types";

// Import a GitHub repo into a project: fetch its file tree (1 API call) then the raw files.
//  - PUBLIC repos → raw CDN (doesn't count against the API rate limit).
//  - PRIVATE repos → pass a personal-access token; files are fetched via the authenticated blob API.
// Text files only, bounded. A branch can be given explicitly or parsed from a /tree/<branch> URL.
const TEXT = /\.(tsx?|jsx?|css|scss|html?|json|md|mjs|cjs|svg|txt|ya?ml|env|gitignore|babelrc|eslintrc|vue|astro|py|rb|go|rs|java|php|sh|sql|toml|ini|xml|prisma|graphql)$/i;
const MAX_FILES = 500;
const MAX_BYTES = 6 * 1024 * 1024;

export function parseRepo(url: string): { owner: string; repo: string; branch?: string } | null {
  const m = url.trim().match(/github\.com\/([^/\s]+)\/([^/\s#?]+)(?:\/tree\/([^/\s#?]+))?/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, ""), branch: m[3] };
}

function authHeaders(token?: string): Record<string, string> {
  return token ? { authorization: `Bearer ${token.trim()}`, accept: "application/vnd.github+json" } : {};
}

export async function importRepo(url: string, opts: { token?: string; branch?: string } = {}): Promise<FileMap> {
  const parsed = parseRepo(url);
  if (!parsed) throw new Error("Not a GitHub repo URL (e.g. https://github.com/owner/repo)");
  const { owner, repo } = parsed;
  const headers = authHeaders(opts.token);

  const meta = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!meta.ok) {
    if (meta.status === 404) throw new Error(opts.token ? "Repo not found (check the URL and that the token can read it)" : "Repo not found — if it's private, add a token below");
    if (meta.status === 401) throw new Error("Invalid token (401)");
    if (meta.status === 403) throw new Error("GitHub rate limit or access denied (403) — add a token");
    throw new Error(`GitHub ${meta.status}`);
  }
  const branch = opts.branch || parsed.branch || (await meta.json()).default_branch || "main";

  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers });
  if (!treeRes.ok) throw new Error(`Branch "${branch}" not found (GitHub ${treeRes.status})`);
  const tree = (await treeRes.json()).tree as { path: string; type: string; size?: number; sha: string }[];

  const blobs = tree
    .filter((t) => t.type === "blob" && TEXT.test(t.path) && !t.path.includes("node_modules/") && !t.path.startsWith(".git/"))
    .sort((a, b) => (a.size || 0) - (b.size || 0))
    .slice(0, MAX_FILES);

  const files: FileMap = {};
  let total = 0;
  await Promise.all(
    blobs.map(async (b) => {
      try {
        let text: string;
        if (opts.token) {
          // Authenticated blob API (works for private repos). Returns base64-encoded content.
          const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs/${b.sha}`, { headers });
          if (!r.ok) return;
          const j = (await r.json()) as { content?: string; encoding?: string };
          text = j.encoding === "base64" && j.content ? decodeURIComponent(escape(atob(j.content.replace(/\n/g, "")))) : j.content || "";
        } else {
          const r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${b.path}`);
          if (!r.ok) return;
          text = await r.text();
        }
        total += text.length;
        if (total > MAX_BYTES) return;
        files[b.path] = text;
      } catch {
        // skip a file that fails to fetch
      }
    }),
  );

  if (Object.keys(files).length === 0) throw new Error("No importable text files found in the repo");
  return files;
}

// List the branches of a repo (for the branch picker). Best-effort; empty on failure.
export async function listBranches(url: string, token?: string): Promise<string[]> {
  const parsed = parseRepo(url);
  if (!parsed) return [];
  try {
    const r = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/branches?per_page=100`, { headers: authHeaders(token) });
    if (!r.ok) return [];
    const list = (await r.json()) as { name: string }[];
    return list.map((b) => b.name);
  } catch {
    return [];
  }
}
