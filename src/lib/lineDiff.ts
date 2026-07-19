// Count added / removed LINES between two versions of a file (VS-Code-style +/− badge). Uses an
// LCS of lines: added = newLines − commonLines, removed = oldLines − commonLines. Capped to avoid an
// O(n·m) blow-up on very large files (falls back to a length delta there).
export function lineDiff(oldStr: string, newStr: string): { added: number; removed: number } {
  if (oldStr === newStr) return { added: 0, removed: 0 };
  const a = oldStr ? oldStr.split("\n") : [];
  const b = newStr ? newStr.split("\n") : [];
  const m = a.length;
  const n = b.length;
  if (!m) return { added: n, removed: 0 };
  if (!n) return { added: 0, removed: m };
  if (m * n > 4_000_000) {
    return { added: Math.max(0, n - m), removed: Math.max(0, m - n) };
  }
  let prev = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    const cur = new Array<number>(n + 1).fill(0);
    const ai = a[i - 1];
    for (let j = 1; j <= n; j++) {
      cur[j] = ai === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  const lcs = prev[n];
  return { added: n - lcs, removed: m - lcs };
}
