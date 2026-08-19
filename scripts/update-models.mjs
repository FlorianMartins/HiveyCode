#!/usr/bin/env node
// 🐝 Daily model auto-updater for HiveyCode.
//
// Keeps src/agent/models.ts (the per-role model assignments behind Free / Smart / Pro) in step with
// the real OpenRouter catalogue — with NO API key and NO human editing:
//
//   1. BUMP    — a role stays on its family but follows the newest release of it
//                (claude-opus-4.8 → claude-opus-4.9, qwen3-coder:free → qwen4-coder:free…).
//                Same family only: never a risky cross-vendor jump behind the user's back.
//   2. REPAIR  — an id that VANISHED from the catalogue (very common for free models, which get
//                rotated out) is replaced by the best surviving model of the same vendor & price
//                class. Without this the Free tier silently 400s on a dead model id.
//
// The picker itself needs no updating: it already lists the LIVE catalogue at runtime.
//
// Usage:
//   node scripts/update-models.mjs           # update models.ts in place
//   node scripts/update-models.mjs --check   # report only, never write
// Exit codes: 0 = no change · 10 = models.ts rewritten (the systemd unit rebuilds on 10) · 1 = error

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_FILE = join(__dirname, "..", "src", "agent", "models.ts");
const API = "https://openrouter.ai/api/v1/models";
const CHECK_ONLY = process.argv.includes("--check");

// Experimental / dated / routing-only SKUs are never chosen automatically.
// ":batch" is the asynchronous batch SKU: cheaper because the answer comes back later, which
// is fatal for a coder role that streams a file the user is watching appear.
const NOT_DEFAULT = /preview|-exp\b|experimental|-20\d{6}\b|multi-agent|deep-research|:batch\b/i;

// The "family stem" of a model id: drop version / size / date tokens, keep the descriptive name.
// "anthropic/claude-opus-4.8" → "anthropic/claude-opus"; "qwen/qwen3-coder:free" → "qwen/qwen-coder".
function modelStem(id) {
  const [prov, ...rest] = id.split("/");
  const name = rest.join("/").replace(/:free$/, "");
  const keep = name
    .split("-")
    .map((tk) => tk.replace(/\d+(\.\d+)*$/, "")) // qwen3 → qwen, gpt-5.6 → gpt
    .filter(
      (tk) =>
        tk &&
        !/^v?\d+(\.\d+)*$/.test(tk) && // 3, 4.8, v3.1
        !/^\d+(\.\d+)?[bkm]$/i.test(tk) && // 32b, 120b
        !/^a\d+[bkm]$/i.test(tk) && // a3b (MoE active params)
        !/^\d{4,}$/.test(tk) && // 0528, 20260420
        !/^(preview|latest|it)$/i.test(tk),
    );
  return `${prov}/${keep.join("-")}`;
}

const isFreeId = (id) => /:free$/.test(id);
const price = (m) => (m && m.pricing && +m.pricing.completion ? +m.pricing.completion * 1e6 : 0);

function main(all) {
  const src = readFileSync(MODELS_FILE, "utf8");
  const s = src.indexOf("// <hivey:start>");
  const e = src.indexOf("// <hivey:end>");
  if (s < 0 || e < 0) throw new Error("markers <hivey:start>/<hivey:end> not found in models.ts");
  const block = src.slice(s, e);
  const objText = block.slice(block.indexOf("{"), block.lastIndexOf("}") + 1);
  const current = new Function(`return (${objText});`)(); // our own file, JS object literal

  const byId = new Map(all.map((m) => [m.id, m]));
  // Newest model per (stem, price class).
  const newest = { free: new Map(), paid: new Map() };
  for (const m of all) {
    if (NOT_DEFAULT.test(m.id)) continue;
    const bucket = isFreeId(m.id) ? newest.free : newest.paid;
    const st = modelStem(m.id);
    const cur = bucket.get(st);
    if (!cur || (m.created || 0) > (cur.created || 0)) bucket.set(st, m);
  }

  const merged = {};
  const notes = [];
  for (const variant of Object.keys(current)) {
    merged[variant] = {};
    for (const role of Object.keys(current[variant])) {
      const cur = current[variant][role];
      const free = isFreeId(cur);
      const pool = free ? newest.free : newest.paid;
      const curM = byId.get(cur);
      const cand = pool.get(modelStem(cur));

      // 1) BUMP within the family.
      if (cand && cand.id !== cur && (cand.created || 0) > (curM ? curM.created || 0 : 0)) {
        // Guard: a same-family bump must not multiply the price by more than 5×.
        const sane = !curM || price(curM) === 0 || price(cand) <= Math.max(price(curM) * 5, 0.5);
        if (sane) {
          merged[variant][role] = cand.id;
          notes.push(`🐝 ${variant}.${role}: ${cur} → ${cand.id}`);
          continue;
        }
      }

      // 2) REPAIR a model that no longer exists (dead id → hard 400 at runtime).
      if (!curM) {
        const vendor = cur.split("/")[0];
        const codeRole = role === "coder" || role === "debugger";
        const pool2 = all.filter(
          (m) =>
            m.id.startsWith(vendor + "/") &&
            isFreeId(m.id) === free &&
            !NOT_DEFAULT.test(m.id) &&
            (m.architecture?.output_modalities || ["text"]).includes("text"),
        );
        // A dead CODER must be replaced by a coding model, not by whatever is newest.
        const alt = pool2
          .sort(
            (a, b) =>
              (codeRole ? (/cod(e|er|ing)/i.test(b.id) ? 1 : 0) - (/cod(e|er|ing)/i.test(a.id) ? 1 : 0) : 0) ||
              (b.created || 0) - (a.created || 0),
          )[0];
        if (alt) {
          merged[variant][role] = alt.id;
          notes.push(`🔧 ${variant}.${role}: ${cur} is GONE from the catalogue → ${alt.id}`);
          continue;
        }

        // 3) WIDEN beyond the vendor. Staying inside the vendor is the safe repair, but it only
        // works while the vendor still ships something in that price class. When Meta and Qwen
        // both withdrew their free tiers, every free role here kept a dead id and the whole Free
        // preset answered HTTP 404 — a vendor-locked repair that repairs nothing is worse than
        // an honest cross-vendor jump, because it looks like it worked.
        const CODEY = /cod(e|er|ing)|devstral|laguna|starcoder/i;
        const wide = all.filter(
          (m) =>
            !/^~/.test(m.id) &&                                     // moving alias: not a stable id to commit
            isFreeId(m.id) === free &&
            !NOT_DEFAULT.test(m.id) &&
            (m.architecture?.output_modalities || ["text"]).includes("text"),
        );
        const maxCtx = Math.max(...wide.map((m) => m.context_length || 0), 1);
        const newestAt = Math.max(...wide.map((m) => m.created || 0), 1);
        const score = (m) => {
          let sc = 2 * ((m.context_length || 0) / maxCtx) + 1.5 * ((m.created || 0) / newestAt);
          // A coder must be able to code; a planner/reviewer/tester writes prose about code and is
          // handicapped by a code-completion specialist, so the preference runs both ways.
          if (CODEY.test(m.id)) sc += codeRole ? 5 : -4;
          if (!free) sc -= Math.min(price(m) / 10, 2);              // among paid, don't pick the priciest by accident
          return sc;
        };
        const any = wide.sort((x, y) => score(y) - score(x))[0];
        if (any) {
          merged[variant][role] = any.id;
          notes.push(`🔧 ${variant}.${role}: ${cur} is GONE, no ${vendor} model left → ${any.id} (cross-vendor)`);
          continue;
        }
        notes.push(`⚠️  ${variant}.${role}: ${cur} is GONE and nothing in the catalogue fits — fix by hand.`);
      }

      merged[variant][role] = cur;
    }
  }

  const nextObj = JSON.stringify(merged, null, 2).replace(/^/gm, "").replace(/\n/g, "\n");
  const nextBlock =
    "// <hivey:start>\nconst MODELS: Record<HiveyVariant, Record<Role, string>> = " + nextObj + ";\n";
  const out = src.slice(0, s) + nextBlock + src.slice(e);

  notes.forEach((n) => console.log(n));
  if (out === src) {
    console.log("🐝 HiveyCode: every role already on the newest model of its family.");
    return 0;
  }
  if (CHECK_ONLY) {
    console.log("🐝 HiveyCode: models.ts WOULD change (run without --check).");
    return 10;
  }
  writeFileSync(MODELS_FILE, out);
  console.log("✓ src/agent/models.ts updated.");
  return 10;
}

const res = await fetch(API, { headers: { "user-agent": "hiveycode-model-updater" } });
if (!res.ok) {
  console.error(`OpenRouter /models HTTP ${res.status}`);
  process.exit(1);
}
const all = ((await res.json()).data || []).filter((m) => m && m.id);
if (!all.length) {
  console.error("OpenRouter returned an empty model list");
  process.exit(1);
}
console.log(`OpenRouter catalogue: ${all.length} models.`);
process.exit(main(all));
