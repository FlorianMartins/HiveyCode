import type { AgentEvent, AgentRequest, FileMap, Role } from "./types";
import { callOR, streamOR, type ORMessage } from "./openrouter";
import { modelFor } from "./models";
import { SYSTEM, INTERVIEWER_SYSTEM, EDITOR_SYSTEM, ADAPTER_SYSTEM, MARKET_SYSTEM } from "./roles";
import { fallbackParse, summariseFiles, createFileStreamParser, parseEdits, applyEdits } from "./parse";
import { lintLayout, issuesForPrompt, type LayoutIssue } from "./layoutLint";
import { fetchPricing, buildEstimate } from "./estimate";
import type { AgentQuestion } from "./types";
import { resolveDepth } from "./router";
import { verifyInSandbox } from "./sandbox";
import { resolveTarget } from "./providers";
import { getTemplate } from "./templates";
import { matchProductTemplate } from "./productTemplates";

// Generous output budget for the CODER/DEBUGGER — a full app is easily >8k tokens, and truncating
// mid-file used to drop the closing </file> tag → "no files" error. 32k leaves ample room. Free
// models often cap their own output far lower and 400 on a huge ask, so we clamp them to 8k (a
// truncated file is still finalized with what streamed, so the user always sees real files).
const CODE_TOKENS = 32000;
const tokensFor = (model: string) => (model.includes(":free") ? 8000 : CODE_TOKENS);

// Some models are REASONING-FIRST: their quality comes from an explicit chain-of-thought (Fable 5,
// o-series, DeepSeek-R1, QwQ, *-thinking). Running them with reasoning OFF cripples them — that's why
// Fable 5 felt "weaker than Opus" in HiveyCode. For the CODER/DEBUGGER we turn reasoning ON for these
// models so they perform at full strength (Opus & co. stay fast with reasoning off; the 32k output
// budget leaves ample room for both the thinking and the code).
export function reasoningFor(model: string): "off" | "high" {
  return /fable|deepseek-r1|deepseek\/deepseek-r|qwq|(^|\/)o[13](\b|-)|[-:]thinking|thinking-|magistral|reasoner/i.test(model)
    ? "high"
    : "off";
}

// Guarantee the vite-react-ts preview can actually render. It styles via the Tailwind Play CDN in
// index.html and boots from a fixed #root + /index.tsx entry; if the coder's index.html lost either,
// the preview goes blank white. Re-inject the CDN when only that is missing; if the #root/entry is gone
// too, the shell is broken → restore the tested scaffold index.html (the app files are untouched).
function ensureReactShell(html: string, scaffoldHtml: string): string {
  // The CRA bundler injects the JS entry itself, so the shell only needs the #root mount point.
  const hasRoot = /id=["']root["']/.test(html);
  if (!hasRoot) return scaffoldHtml || html; // broken shell → restore the known-good one
  if (!/cdn\.tailwindcss\.com/.test(html) && /<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, '    <script src="https://cdn.tailwindcss.com"></script>\n  </head>');
  }
  return html;
}

// Largest k (≤ cap) such that the END of `prev` equals the START of `next`. Used to drop text a model
// repeated when resuming a cut-off response, so the stitched output has no duplicated code.
function suffixPrefixOverlap(prev: string, next: string, cap: number): number {
  const max = Math.min(cap, prev.length, next.length);
  for (let k = max; k > 0; k--) {
    if (prev.slice(prev.length - k) === next.slice(0, k)) return k;
  }
  return 0;
}

// Stream a code-producing role (coder/debugger). Emits file-open / file-delta / file events so the
// UI shows files being written live, and collects the FINAL files into `out.files`. If the model
// never used the <file> format, we fall back to markdown-fence parsing of the whole buffer.
async function* streamCode(
  opts: { model: string; messages: ORMessage[]; apiKey: string; baseUrl?: string; reasoning?: "off" | "high" | "max"; role?: Role },
  out: { files: FileMap; raw: string; opened: boolean; narration?: string },
): AsyncGenerator<AgentEvent> {
  const role = opts.role ?? "coder";
  const parser = createFileStreamParser();
  function* emit(e: ReturnType<typeof parser.push>[number]): Generator<AgentEvent> {
    if (e.kind === "open") {
      out.opened = true;
      yield { type: "file-open", path: e.path };
      yield { type: "status", role, message: `Writing ${e.path}…` };
    } else if (e.kind === "delta") {
      yield { type: "file-delta", path: e.path, chunk: e.chunk };
    } else {
      out.files[e.path] = e.content;
      yield { type: "file", path: e.path, content: e.content };
    }
  }
  let thinkingAnnounced = false;
  let emittedTok = 0; // completion tokens already streamed live (reconciled against the final usage)
  let sinceBeat = 0;
  // Honour the caller's reasoning setting. Reasoning is enabled by the orchestrator ONLY for models that
  // can think WITHOUT starving their file output (Opus on the Pro tier). Reasoning-FIRST models (Fable 5,
  // R1, QwQ…) are still forced off upstream — they used to spend the whole budget "thinking" and emit
  // truncated / no <file> blocks (the blank-preview bug). And even for Opus, the CONTINUATION loop below
  // finishes any file the token budget cut off, so thinking can no longer leave a broken preview.
  const wantReason = opts.reasoning && opts.reasoning !== "off" ? opts.reasoning : "off";
  const MAX_CONT = 2; // continuation rounds when the output is cut off by the token limit
  let messages = opts.messages;
  let round = 0;
  while (true) {
    const contMode = round > 0;
    // Continuations don't re-think (avoids a think→truncate spiral and saves tokens): reasoning round 0 only.
    const reasoning: "off" | "high" | "max" = contMode ? "off" : wantReason;
    const prevLen = parser.buffer().length;
    let finishReason: string | undefined;
    let contRaw = ""; // continuation body held back so we can strip any repeated overlap before parsing

    for await (const delta of streamOR({
      model: opts.model, messages, apiKey: opts.apiKey, baseUrl: opts.baseUrl, reasoning, maxTokens: tokensFor(opts.model),
    })) {
      if (delta.finish) { finishReason = delta.finish; continue; }
      if (delta.reasoning) {
        if (!thinkingAnnounced) {
          thinkingAnnounced = true;
          // Reflect the real phase: the model is THINKING (not writing yet).
          yield { type: "status", role, message: role === "debugger" ? "Thinking about the fix…" : "Thinking through the approach…" };
        }
        yield { type: "reasoning", chunk: delta.reasoning }; // live "it's thinking" feedback
        continue;
      }
      if (delta.usage) {
        const u = delta.usage; // reconcile against tokens already streamed live
        yield { type: "usage", role, model: opts.model, prompt: u.prompt, completion: Math.max(0, u.completion - emittedTok), cost: u.cost };
        continue;
      }
      if (delta.content) {
        if (contMode) contRaw += delta.content; // parsed after the round (post de-dup)
        else for (const e of parser.push(delta.content)) yield* emit(e);
        // Live token estimate → the token/price meter moves in real time during code generation.
        sinceBeat += delta.content.length;
        if (sinceBeat >= 500) {
          sinceBeat = 0;
          const estTok = Math.round((parser.buffer().length + contRaw.length) / 4);
          const d = estTok - emittedTok;
          if (d > 0) { emittedTok = estTok; yield { type: "usage", role, model: opts.model, prompt: 0, completion: d, cost: 0 }; }
        }
      }
    }

    // Feed a continuation round into the parser AFTER stripping any prefix it repeated from where it was
    // cut off — so a resumed file never duplicates a line of code.
    if (contMode && contRaw) {
      const overlap = suffixPrefixOverlap(parser.buffer(), contRaw, 600);
      for (const e of parser.push(contRaw.slice(overlap))) yield* emit(e);
    }

    // Was the output cut off? finish_reason "length", or a <file> left open (opens > closes).
    const raw = parser.buffer();
    const opens = (raw.match(/<file\s+path=/gi) || []).length;
    const closes = (raw.match(/<\/file>/gi) || []).length;
    const cutOff = finishReason === "length" || opens > closes;
    const grew = raw.length > prevLen;
    if (!cutOff || round >= MAX_CONT || (contMode && !grew)) break; // done, capped, or continuation stalled

    round++;
    yield { type: "status", role, message: "Finishing a long file…" };
    messages = [
      ...opts.messages,
      { role: "assistant", content: raw.slice(-6000) },
      {
        role: "user",
        content:
          "Your previous message was CUT OFF mid-output by the token limit. Continue from EXACTLY where you " +
          "stopped: do NOT repeat any text already written, do NOT add explanations, do NOT re-open the current " +
          "<file> tag. Just continue the remaining file content, then any remaining files, closing each with </file>.",
      },
    ];
  }
  for (const e of parser.finish()) yield* emit(e);
  out.raw = parser.buffer();
  // The model's plain-text explanation is whatever it wrote BEFORE the first <file> block.
  out.narration = out.raw
    .split(/<file\s+path=/i)[0]
    .replace(/```[\s\S]*$/, "")
    .trim();
  if (!out.opened) {
    for (const [p, c] of Object.entries(fallbackParse(out.raw))) {
      out.files[p] = c;
      yield { type: "file", path: p, content: c };
    }
  }
}

// EDIT mode (existing project): the coder emits search/replace patches. We buffer the raw output
// (surfacing any reasoning), then parse + apply the patches. Far fewer output tokens than rewriting.
async function* streamPatch(
  opts: { model: string; messages: ORMessage[]; apiKey: string; baseUrl?: string; reasoning?: "off" | "high" | "max" },
  out: { raw: string; narration: string },
): AsyncGenerator<AgentEvent> {
  let raw = "";
  let emittedTok = 0; // completion tokens already streamed live (reconciled against the final usage)
  let sinceBeat = 0;
  // Edits never force reasoning either (same fable5 "no preview / truncated patch" reason as streamCode).
  const effReason = opts.reasoning && opts.reasoning !== "off" ? opts.reasoning : "off";
  for await (const delta of streamOR({ ...opts, reasoning: effReason, maxTokens: tokensFor(opts.model) })) {
    if (delta.reasoning) {
      yield { type: "reasoning", chunk: delta.reasoning };
      continue;
    }
    if (delta.usage) {
      // Reconcile: only count the completion tokens NOT already streamed live, so totals stay exact.
      const u = delta.usage;
      yield { type: "usage", role: "coder", model: opts.model, prompt: u.prompt, completion: Math.max(0, u.completion - emittedTok), cost: u.cost };
      continue;
    }
    if (delta.content) {
      raw += delta.content;
      sinceBeat += delta.content.length;
      // Heartbeat: keep the UI alive during a long edit (the buffered patch emits no files until the
      // end) + stream a live completion-token estimate so the token/price meter moves in real time.
      if (sinceBeat >= 500) {
        sinceBeat = 0;
        yield { type: "status", role: "coder", message: `Editing the project… (${(raw.length / 1000).toFixed(1)}k chars)` };
        const estTok = Math.round(raw.length / 4);
        const d = estTok - emittedTok;
        if (d > 0) { emittedTok = estTok; yield { type: "usage", role: "coder", model: opts.model, prompt: 0, completion: d, cost: 0 }; }
      }
    }
  }
  out.raw = raw;
  out.narration = raw
    .split(/<(?:edit|file)\s+path=/i)[0]
    .replace(/```[\s\S]*$/, "")
    .trim();
}

// callOR for a non-streaming role (planner/reviewer/debugger/…) that also emits a `usage` event so
// the UI can show tokens + $ cost per role in real time. `const text = yield* callRole(role, {...})`.
async function* callRole(
  role: Role,
  opts: Parameters<typeof callOR>[0],
): AsyncGenerator<AgentEvent, string> {
  let usage: { prompt: number; completion: number; cost: number } | undefined;
  const text = await callOR({ ...opts, onUsage: (u) => (usage = u) });
  if (usage) yield { type: "usage", role, model: opts.model, ...usage };
  return text;
}

/**
 * 🐝 The best-of-both-worlds orchestrator.
 *
 *   FAST  (bolt-style)   : one direct CODER pass → instant, cheap. For edits/tweaks.
 *   DEEP  (agentic)      : PLANNER → CODER → REVIEWER → DEBUGGER → … For real builds.
 *
 * "auto" picks the depth from a cheap heuristic (router.ts) — no extra LLM call. The user can
 * force fast/deep. Each role runs on the best-value model for its job; reasoning stays opt-in.
 */
export async function* runAgents(req: AgentRequest): AsyncGenerator<AgentEvent> {
  const { prompt, files, apiKey, keys = {}, localBaseUrls = {}, variant, reasoning, mode = "auto", template, interview, answered, planOnly, approvedPlan, ask, estimate, approvedEstimate } = req;
  const hasProject = Object.keys(files).length > 0;
  const depth = resolveDepth(mode, prompt, hasProject);
  const tpl = getTemplate(template);
  const isSmart = variant === "hivey/smart";

  // Resolve the chosen model to a provider target (OpenRouter / OpenAI / Gemini / Groq…) + its key.
  const tgt = resolveTarget(variant, { openrouter: apiKey || "", ...keys }, localBaseUrls);
  const pick = (role: Role) => (tgt.hivey ? modelFor(variant, role) : tgt.model);
  const conn = { apiKey: tgt.apiKey, baseUrl: tgt.baseUrl };

  // 🐝 Pro ("hivey/smart") spends the TOP model (Opus) on the OPENING too — the guided interview and
  // the feature-scoping. That opening is where innovation & "force de proposition" come from: a top
  // model proposes bolder options and a richer, more complete feature set, so the whole build starts
  // from a stronger brief. Smart/Free (and any concrete pick) keep the normal planner model there.
  const openerModel = variant === "hivey/smart" ? pick("coder") : pick("planner");

  // ── ASK mode ────────────────────────────────────────────────────────────────
  // Read-only Q&A about the project — NO build, NO file edits. For "what does X do?", "where is Y?",
  // "how would I add Z?". Answers in markdown using the current files as context, then stops.
  if (ask) {
    try {
      yield { type: "status", role: "reviewer", message: hasProject ? "Reading the project to answer…" : "Thinking…" };
      const ctx = hasProject ? `\n\nCURRENT PROJECT (reference only — DO NOT rewrite it):\n${summariseFiles(files)}` : "";
      const answer = yield* callRole("reviewer", {
        model: pick("coder"), // the strong model — this is a real answer, not housekeeping
        ...conn,
        maxTokens: 2000,
        messages: [
          {
            role: "system",
            content:
              "You are a senior engineer answering questions about the user's project inside an AI code workshop. " +
              "Answer clearly and concisely in MARKDOWN — reference real file names/paths and short code snippets where helpful. " +
              "You are in READ-ONLY 'Ask' mode: DO NOT output <file> blocks and DO NOT rewrite the app — only explain, advise, or point to where things are. " +
              "If the user asks for a change, describe HOW you'd do it and tell them to turn OFF Ask mode to have you build it.",
          },
          { role: "user", content: prompt + ctx },
        ],
      });
      yield { type: "message", content: (answer && answer.trim()) || "I couldn't produce an answer — try rephrasing the question." };
    } catch (e) {
      yield { type: "error", message: e instanceof Error ? e.message : String(e) };
    }
    yield { type: "done" };
    return;
  }
  // Reasoning: OFF by default; ENABLED (high) ONLY for the Pro tier's code-producing roles (coder /
  // debugger / completeness), and ONLY because both guards that used to make thinking break the preview
  // are now in place: (a) Pro's coder is Opus — a model that thinks WITHOUT starving its file output;
  // reasoning-FIRST models (Fable 5, R1, QwQ…), detected by reasoningFor(), are still forced off because
  // they spend the whole budget in a think-monologue and emit no <file> blocks; and (b) streamCode now
  // has a CONTINUATION net that finishes any file the token budget cut off. This gives Pro true
  // Opus-with-thinking quality while the live preview always renders. Edits/patches (streamPatch) stay
  // OFF — a truncated patch can't be safely resumed like a full-file stream.
  void reasoning;
  // Enabled for BOTH paid Hivey tiers — Pro (Opus) AND Smart (Sonnet) — so they think through the build
  // like Claude Code, not one-shot it. Sonnet & Opus both think WITHOUT starving their file output, and
  // the continuation net finishes anything the budget cuts off. Still forced OFF for Free, for any
  // concrete non-Hivey pick, and for reasoning-FIRST models (Fable 5 / R1 / QwQ) that emit no files.
  const thinkTier = variant === "hivey/smart" || variant === "hivey";
  const effReasoning: "off" | "high" | "max" = thinkTier && reasoningFor(pick("coder")) !== "high" ? "high" : "off";

  // ── GUIDED interview (Hivey Smart only) ─────────────────────────────────────────────────────
  // Before building, ask the user a few sharp questions so we hit exactly what they had in mind
  // (unless they chose to skip: interview === false, or forced Fast mode). It can still build alone.
  if (isSmart && interview !== false && mode !== "fast" && !hasProject && tgt.apiKey) {
    try {
      yield { type: "status", role: "planner", message: "Understanding exactly what you want…" };
      const raw = yield* callRole("planner", {
        model: openerModel,
        ...conn,
        maxTokens: 1100,
        reasoning: "high",
        messages: [
          { role: "system", content: INTERVIEWER_SYSTEM },
          { role: "user", content: hasProject ? `REQUEST:\n${prompt}\n\nEXISTING PROJECT:\n${summariseFiles(files)}` : prompt },
        ],
      });
      const parsed = parseQuestions(raw);
      if (parsed && parsed.questions.length) {
        yield { type: "questions", intro: parsed.intro, questions: parsed.questions };
        yield { type: "done" };
        return;
      }
      // No questions produced → just build (it can work alone).
    } catch {
      // Interview failed → fall through and build normally.
    }
  }

  // Brand-new project → start from the selected template's ready scaffold instead of regenerating
  // boilerplate. The model only writes the files it needs → far faster & cheaper. Seed it to the UI
  // up-front so the file tree (and the live preview, for web stacks) light up instantly.
  const fresh = !hasProject;
  // Product template: for a from-scratch React build, auto-pick the closest product type (dashboard,
  // landing, kanban, chat, e-commerce…). If it ships a rich seed we start FROM it and only prune/adapt
  // (edit-from-template mode → far fewer tokens, instant preview); either way we reuse its pre-baked
  // feature checklist so the coder builds a COMPLETE product without an extra market LLM call.
  const product = fresh && tpl.id === "react" ? matchProductTemplate(prompt) : null;
  // Use the rich seed as a PATCH head-start ONLY when the user did NOT answer clarifying questions.
  // Once they've made explicit choices (esp. the VISUAL STYLE), the diff/patch path anchors to the
  // TEMPLATE's design and quietly ignores those choices — so we build fresh (full files, high
  // reasoning) instead, honouring the FIRM REQUIREMENTS. The seed still seeds baseFiles as a
  // reference + its feature checklist is still reused, so it stays a head-start, not a cage.
  const fromTemplate = !!product?.files && !answered;
  // Seed the rich template files ONLY on the patch head-start path. When the user answered questions
  // (fromTemplate=false) we keep just the plain scaffold so the seed's look can't anchor the design —
  // the coder builds fresh to the chosen style, still guided by the product's feature checklist.
  const baseFiles: FileMap = fresh ? { ...tpl.scaffold, ...(fromTemplate ? product!.files : {}) } : files;
  // ── COST GATE ─────────────────────────────────────────────────────────────
  // Placed HERE, immediately before the coder, because the coder is 88–99% of the bill (measured
  // across real runs). A confirmation asked after generation would be theatre: the money is spent
  // by then. Skipped for local models (free), when the user opted out, and once approved.
  if (estimate !== false && !approvedEstimate && !hasProject && tgt.apiKey && /openrouter\.ai/.test(conn.baseUrl || "")) {
    const pricing = await fetchPricing(tgt.apiKey, conn.baseUrl);
    const est = buildEstimate({
      shape: fromTemplate ? "template" : "scratch",
      depth: depth === "fast" ? "fast" : "deep",
      coderModel: pick("coder"),
      reviewerModel: pick("reviewer"),
      pricing,
    });
    if (est.priced) {
      yield { type: "estimate", low: est.low, high: est.high, priced: est.priced, basis: est.basis, lines: est.lines };
      yield { type: "done" };
      return;
    }
    // Pricing unavailable → don't block the user behind a number we can't produce; just build.
  }

  if (fresh) for (const [path, content] of Object.entries(baseFiles)) yield { type: "file", path, content };
  if (fromTemplate) yield { type: "status", role: "coder", message: `Starting from the ${product!.label} template…` };

  // ── PLAN-FIRST ──────────────────────────────────────────────────────────────
  // "Plan before build": produce the architecture plan and STOP, so the user can read/edit/approve
  // it before any code is written (more control, fewer wasted tokens). The client then re-runs with
  // `approvedPlan`, which skips the planner below and hands the (possibly edited) plan to the coder.
  if (planOnly) {
    try {
      yield { type: "status", role: "planner", message: hasProject ? "Planning the change…" : "Planning the architecture…" };
      const p = yield* callRole("planner", {
        model: pick("planner"),
        ...conn,
        maxTokens: 700,
        messages: [
          { role: "system", content: SYSTEM.planner },
          { role: "user", content: hasProject ? `REQUEST:\n${prompt}\n\nEXISTING PROJECT:\n${summariseFiles(files)}` : prompt },
        ],
      });
      yield { type: "plan", content: p };
    } catch (e) {
      yield { type: "error", message: e instanceof Error ? e.message : String(e) };
    }
    yield { type: "done" };
    return;
  }

  try {
    // ── FEATURE SCOPING (from-scratch deep builds) ─────────────────────────────
    // Enumerate the features a best-in-class version of this product has, so the coder builds a
    // COMPLETE app instead of a minimal one. Injected as ADDITIVE requirements below. A matched
    // product template supplies this for free; otherwise a cheap market call enumerates them.
    let features = product?.features || "";
    if (!features && fresh && depth === "deep") {
      yield { type: "status", role: "planner", message: "Scoping the expected features…" };
      features = yield* callRole("planner", {
        model: openerModel,
        ...conn,
        maxTokens: 650,
        messages: [
          { role: "system", content: MARKET_SYSTEM },
          { role: "user", content: prompt },
        ],
      });
    }
    if (features.trim()) yield { type: "plan", content: "**Expected features**\n\n" + features };

    // ── No separate architecture-plan step ────────────────────────────────────
    // A short plan written by a (often cheaper) planner model ANCHORED the stronger coder to a
    // minimal, off-target implementation — the #1 cause of thin/"horrible" results. The coder now
    // plans INLINE (Claude-Code style), driven by the EXPECTED-FEATURES list above + its own strong
    // system prompt; the reviewer COMPLETENESS pass below then enforces that nothing is missing.
    // `approvedPlan` is kept only for request-shape back-compat (always empty now — plan-first removed).
    const plan = approvedPlan || "";
    if (depth === "fast") yield { type: "status", role: "orchestrator", message: "Fast edit…" };

    // ── CODE ──────────────────────────────────────────────────────────────────
    // NEW project → the coder writes full files (streamed live). EXISTING project → the coder emits
    // targeted search/replace PATCHES (Claude-Code-style): ~10× fewer output tokens & much faster.
    let project: FileMap;
    const touched = new Set<string>();
    let narration = "";
    // Set when the template head-start actually produced applicable changes. If it stays null we fall
    // through to the full-build path below rather than shipping the untouched seed.
    let tplApplied: { files: FileMap } | null = null;
    // Merge base for the full build — downgraded to the bare scaffold if the template attempt failed.
    let buildBase: FileMap = baseFiles;

    if (fromTemplate) {
      // TEMPLATE AS A HEAD-START (not a cage): the rich seed already renders and gives the coder the
      // structure/logic/data for free (fewer tokens). But the coder must ELEVATE it into a bespoke,
      // design-faithful, better-than-the-seed result — reusing verbatim only where it already fits,
      // rewriting whole files where the requested design/quality demands (see ADAPTER_SYSTEM).
      yield { type: "status", role: "coder", message: "Building your app from a head-start template…" };
      const tplUser =
        `You are given a COMPLETE, already-working ${product!.label} template (a ${tpl.label} project that renders as-is). Use it as a STRUCTURE & logic HEAD-START and turn it into EXACTLY the app the user asked for — bespoke, precise and MORE polished/innovative than this generic seed. Apply the user's chosen DESIGN/theme in full across every file; reuse the template verbatim ONLY where it already matches that design and quality.\n\n` +
        `USER REQUEST:\n${prompt}` +
        (features ? `\n\nEXPECTED FEATURES — ensure ALL are present, fully wired (ADDITIVE, never a limit — do MORE, not less):\n${features}` : "") +
        `\n\nTEMPLATE (adapt these EXACT contents — any <edit> SEARCH text must match VERBATIM):\n${summariseFiles(baseFiles)}`;
      const tplMsgs: ORMessage[] = [
        { role: "system", content: ADAPTER_SYSTEM },
        { role: "user", content: tplUser },
      ];
      const t1 = { raw: "", narration: "" };
      // Patches stay reasoning-OFF: a cut-off patch can't be resumed as safely as a full-file stream.
      yield* streamPatch({ model: pick("coder"), ...conn, reasoning: "off", messages: tplMsgs }, t1);
      const parsed = parseEdits(t1.raw);
      const applied = applyEdits(baseFiles, parsed.patches, parsed.fullFiles);
      // Did the adaptation actually LAND? Three ways it silently doesn't, all of which used to ship
      // the generic seed as if it were the user's app:
      //   • nothing applicable at all (patch truncated at the CODE_TOKENS ceiling — and unlike
      //     streamCode, streamPatch has no continuation loop to resume it);
      //   • some SEARCH snippets didn't match the file verbatim, so those edits were dropped;
      //   • the edits landed only on peripheral files (index.html / styles.css) while the MAIN
      //     component — the one that carries the whole app — kept the seed's content. Observed for
      //     real: a "dark analytics dashboard" request came back as the light seed with a restyled
      //     stylesheet, and every requested feature missing.
      // Any of the three means the result is not the requested app, so fall through to a REAL full
      // build and drop the seed so its look can't anchor the design.
      const mainFile = Object.keys(baseFiles).find((p) => /(^|\/)App\.(t|j)sx$/.test(p));
      const mainChanged = !mainFile || applied.changed.includes(mainFile);
      const landed = applied.changed.length > 0 && mainChanged && applied.failures.length === 0;

      if (landed) {
        tplApplied = applied;
        narration = t1.narration;
        applied.changed.forEach((p) => touched.add(p));
        for (const p of applied.changed) {
          yield { type: "file-open", path: p };
          yield { type: "file", path: p, content: applied.files[p] };
        }
      } else {
        const why = !applied.changed.length
          ? "came back empty"
          : applied.failures.length
            ? `couldn't apply ${applied.failures.length} edit(s)`
            : `left ${mainFile} untouched`;
        yield {
          type: "status",
          role: "coder",
          message: `The template adaptation ${why} — building your app from scratch instead…`,
        };
        buildBase = { ...tpl.scaffold };
      }
    }

    if (tplApplied) {
      project = tplApplied.files;
    } else if (fresh) {
      yield { type: "status", role: "coder", message: "The coder is starting…" };
      const scaffoldNote = Object.keys(tpl.scaffold).length
        ? `A starter scaffold already exists (shown below) — build INTO it and output ONLY the files to CREATE or CHANGE (don't re-output boilerplate you aren't changing).`
        : `Output every file the project needs.`;
      const coderUser =
        `Build the requested app as a ${tpl.label} (${tpl.lang}) project.\n\nSTACK RULES: ${tpl.guide}\n\n${scaffoldNote}\n\n` +
        `USER REQUEST:\n${prompt}` +
        (features ? `\n\nEXPECTED FEATURES — build ALL of these (ADDITIVE, never a limit — do MORE, not less):\n${features}` : "") +
        (plan ? `\n\nPLAN:\n${plan}` : "") +
        `\n\n${Object.keys(buildBase).length ? `SCAFFOLD:\n${summariseFiles(buildBase)}` : ""}`;
      const coderMsgs: ORMessage[] = [
        { role: "system", content: SYSTEM.coder },
        { role: "user", content: coderUser },
      ];
      const first = { files: {} as FileMap, raw: "", opened: false, narration: "" };
      yield* streamCode({ model: pick("coder"), ...conn, reasoning: effReasoning, messages: coderMsgs }, first);
      let edits = first.files;
      narration = first.narration || "";
      if (Object.keys(edits).length === 0) {
        yield { type: "status", role: "coder", message: "Reformatting the output…" };
        const retryMsgs: ORMessage[] = [
          ...coderMsgs,
          { role: "assistant", content: first.raw.slice(0, 2000) },
          { role: "user", content: 'You did not output any <file> blocks. Output the project NOW as ONLY <file path="…">…</file> blocks, nothing else.' },
        ];
        const second = { files: {} as FileMap, raw: "", opened: false, narration: "" };
        // Reformat retry = no thinking, just re-emit as <file> blocks.
        yield* streamCode({ model: pick("coder"), ...conn, reasoning: "off", messages: retryMsgs }, second);
        edits = second.files;
        narration = second.narration || narration;
        if (Object.keys(edits).length === 0) {
          if (first.raw.trim()) yield { type: "message", content: first.raw.slice(0, 1500) };
          yield { type: "error", message: "The model didn't return files in the expected format. Try Hivey / Hivey Smart (stronger) or rephrase." };
          yield { type: "done" };
          return;
        }
      }
      project = { ...buildBase, ...edits };
      Object.keys(edits).forEach((p) => touched.add(p));

      // Safety net (React): the fixed entry renders <App/> from "./App". If the coder didn't overwrite
      // the ROOT App.tsx (wrote its app under src/, named the component differently, put everything in
      // components/…), the placeholder stays and the preview is stuck on "Setting up your project…".
      // Detect that the root App.tsx is STILL the placeholder, find the coder's real entry component,
      // and repoint index.tsx at it so the app actually renders.
      const rootAppStuck = tpl.id === "react" && (project["App.tsx"] || "").includes("Setting up your project") && !edits["index.tsx"] && !edits["index.html"];
      if (rootAppStuck) {
        // Prefer an App.(t|j)sx written elsewhere; else any file with a default-exported component.
        const appPath =
          Object.keys(edits).find((p) => p !== "App.tsx" && /(^|\/)App\.(t|j)sx$/.test(p)) ||
          Object.keys(edits).find((p) => /\.(t|j)sx$/.test(p) && /export\s+default/.test(edits[p] || ""));
        if (appPath) {
          const importPath = "./" + appPath.replace(/\.(t|j)sx$/, "");
          const styles = Object.keys(project).find((p) => /(^|\/)(styles|index|globals?)\.css$/.test(p)) || "styles.css";
          project["index.tsx"] =
            `import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "${importPath}";\nimport "./${styles}";\n\n` +
            `createRoot(document.getElementById("root") as HTMLElement).render(\n  <StrictMode>\n    <App />\n  </StrictMode>,\n);\n`;
          touched.add("index.tsx");
          yield { type: "file", path: "index.tsx", content: project["index.tsx"] };
        }
      }
    } else {
      yield { type: "status", role: "coder", message: "Editing the project…" };
      const editUser =
        `Make this change to the existing ${tpl.label} project.\n\nREQUEST:\n${prompt}${plan ? `\n\nPLAN:\n${plan}` : ""}\n\n` +
        `CURRENT PROJECT (patch against these EXACT contents):\n${summariseFiles(files)}`;
      const editMsgs: ORMessage[] = [
        { role: "system", content: EDITOR_SYSTEM },
        { role: "user", content: editUser },
      ];
      const p1 = { raw: "", narration: "" };
      // Patches stay reasoning-OFF (a cut-off patch can't be resumed safely like a full-file stream).
      yield* streamPatch({ model: pick("coder"), ...conn, reasoning: "off", messages: editMsgs }, p1);
      let { patches, fullFiles } = parseEdits(p1.raw);
      narration = p1.narration;
      if (!patches.length && !Object.keys(fullFiles).length) {
        yield { type: "status", role: "coder", message: "Reformatting the change…" };
        const p2 = { raw: "", narration: "" };
        yield* streamPatch(
          {
            model: pick("coder"),
            ...conn,
            reasoning: "off",
            messages: [
              ...editMsgs,
              { role: "assistant", content: p1.raw.slice(0, 1500) },
              { role: "user", content: 'Output the change NOW as <edit path="…"> SEARCH/REPLACE blocks (or a full <file> block for a NEW file), nothing else.' },
            ],
          },
          p2,
        );
        const r2 = parseEdits(p2.raw);
        patches = r2.patches;
        fullFiles = r2.fullFiles;
        if (!narration) narration = p2.narration;
      }
      if (!patches.length && !Object.keys(fullFiles).length) {
        if (p1.raw.trim()) yield { type: "message", content: p1.raw.slice(0, 1500) };
        yield { type: "error", message: "The model didn't return an applicable edit. Rephrase or try again." };
        yield { type: "done" };
        return;
      }
      const applied = applyEdits(files, patches, fullFiles);
      project = applied.files;
      applied.changed.forEach((p) => touched.add(p));
      for (const p of applied.changed) {
        yield { type: "file-open", path: p };
        yield { type: "file", path: p, content: project[p] };
      }
      if (applied.failures.length) {
        const paths = [...new Set(applied.failures.map((f) => f.path))].join(", ");
        narration += (narration ? "\n\n" : "") + `Couldn\u0027t locate ${applied.failures.length} snippet(s) to patch in ${paths} — re-run if a change is missing.`;
      }
    }

    // ── PREVIEW SHELL REPAIR ──────────────────────────────────────────────────
    // A common cause of a blank preview: the coder rewrote index.html and dropped the Tailwind Play CDN
    // <script> (→ every utility class renders unstyled = blank-looking) or the `<div id="root">` (→
    // nothing mounts). For the React stack, deterministically repair the root shell so the preview always
    // renders — re-inject the CDN, or restore the known-good scaffold index.html. (Sandbox.tsx relocates
    // this file to public/index.html for the CRA bundler; here we operate on the store's root copy.)
    if (tpl.sandpack === "react-ts" && project["index.html"] != null) {
      const repaired = ensureReactShell(project["index.html"], tpl.scaffold["index.html"] || "");
      if (repaired !== project["index.html"]) {
        project = { ...project, "index.html": repaired };
        touched.add("index.html");
        yield { type: "file", path: "index.html", content: repaired };
      }
    }

    // ── LAYOUT LINT (deterministic) ───────────────────────────────────────────
    // The LAYOUT rules in the coder prompt are guidance and land probabilistically. These defects are
    // mechanical, so we check them in code: the missing-min-size family is repaired outright (adding
    // the class cannot break a correct layout), and what can't be safely auto-fixed is collected as
    // located facts for the debugger — which is far cheaper than paying a model to go find them.
    let layoutIssues: LayoutIssue[] = [];
    {
      const lint = lintLayout(project);
      if (lint.fixes.length) {
        for (const [path, content] of Object.entries(lint.files)) {
          if (content !== project[path]) {
            touched.add(path);
            yield { type: "file", path, content };
          }
        }
        project = lint.files;
        yield {
          type: "status",
          role: "orchestrator",
          message: `Layout check: repaired ${lint.fixes.length} sizing defect(s) automatically.`,
        };
      }
      layoutIssues = lint.issues;
    }

    // The coder's own explanation of what it did (a real chat message, not just a status).
    if (narration) yield { type: "message", content: narration.slice(0, 1500) };

    // FAST path stops here — instant, no council.
    if (depth === "fast") {
      yield { type: "message", content: fileRecap([...touched], hasProject) };
      yield { type: "done" };
      return;
    }

    // FREE tier: skip the token-hungry TEST→DEBUG + completeness council BY DEFAULT. Free models have
    // tight daily token quotas ("les tokens partent trop vite"), and each extra verify/fix pass spends
    // several thousand more. The single coder pass is the deliverable; the user can re-run or switch to
    // Smart/Pro for the full agentic review.
    if (variant === "hivey/free") {
      yield { type: "message", content: fileRecap([...touched], hasProject) };
      yield { type: "done" };
      return;
    }

    // ── TEST → DEBUG loop (deep only) — grounded in REAL execution ────────────
    // The TESTER runs the actual sandbox type-check (ground truth, like OpenCode's LSP diagnostics /
    // OpenHands' execution observations) instead of an LLM guessing. If it's red, the DEBUGGER fixes
    // the REAL errors and we re-verify — a bounded plan→code→test→fix loop.
    const MAX_FIX = 2;
    for (let i = 0; i <= MAX_FIX; i++) {
      yield { type: "status", role: "tester", message: i === 0 ? "Type-checking the project…" : `Re-checking types (pass ${i + 1})…` };
      const verify = refineVerify(await verifyInSandbox(project, "typecheck"));

      if (verify === null) {
        // Sandbox unavailable / non-TS project → fall back to a single LLM review pass.
        const reviewRaw = yield* callRole("reviewer", {
          model: pick("reviewer"),
          ...conn,
          maxTokens: 1200,
          // Reviewer = JSON verdict + evidence → no heavy reasoning (latency/cost).
          messages: [
            { role: "system", content: SYSTEM.reviewer },
            { role: "user", content: summariseFiles(project) },
          ],
        });
        const review = safeJson(reviewRaw);
        yield { type: "review", ok: review.ok, notes: review.notes };
        if (!review.ok && review.notes) {
          yield { type: "status", role: "debugger", message: "Fixing the issues found…" };
          const fix = { files: {} as FileMap, raw: "", opened: false };
          yield* streamCode(
            {
              model: pick("debugger"),
              ...conn,
              reasoning: effReasoning,
              role: "debugger",
              messages: [
                { role: "system", content: SYSTEM.debugger },
                { role: "user", content: `ISSUES:\n${review.notes}\n\nCURRENT PROJECT:\n${summariseFiles(project)}` },
              ],
            },
            fix,
          );
          project = { ...project, ...fix.files };
          Object.keys(fix.files).forEach((p) => touched.add(p));
        }
        break;
      }

      yield { type: "review", ok: verify.ok, notes: verify.ok ? "Type-check passed" : verify.output };
      if (verify.ok || i === MAX_FIX) break;

      yield { type: "status", role: "debugger", message: "Fixing the real errors…" };
      const fix = { files: {} as FileMap, raw: "", opened: false };
      yield* streamCode(
        {
          model: pick("debugger"),
          ...conn,
          reasoning: effReasoning,
          messages: [
            { role: "system", content: SYSTEM.debugger },
            {
              role: "user",
              content: `The type-checker reported these REAL errors — fix them. Output the complete corrected files.\n\nERRORS:\n${verify.output}\n\nCURRENT PROJECT:\n${summariseFiles(project)}`,
            },
          ],
        },
        fix,
      );
      project = { ...project, ...fix.files };
      Object.keys(fix.files).forEach((p) => touched.add(p));
    }

    // ── LAYOUT REPAIR (only what the lint could not fix itself) ───────────────
    // One bounded, diff-based pass. The issues are already located (file:line + the reason), so the
    // model spends its tokens fixing rather than searching. Skipped entirely when the lint found
    // nothing — the common case once the auto-fixes have run.
    if (layoutIssues.length) {
      yield { type: "status", role: "debugger", message: `Fixing ${layoutIssues.length} layout defect(s)…` };
      const lp = { raw: "", narration: "" };
      yield* streamPatch(
        {
          model: pick("debugger"),
          ...conn,
          reasoning: "off",
          messages: [
            { role: "system", content: SYSTEM.debugger },
            {
              role: "user",
              content:
                `A deterministic layout linter found these defects. They are REAL and already located — ` +
                `fix each one, changing nothing else.\n\nDEFECTS:\n${issuesForPrompt(layoutIssues)}\n\n` +
                `CURRENT PROJECT:\n${summariseFiles(project)}`,
            },
          ],
        },
        lp,
      );
      const parsedL = parseEdits(lp.raw);
      const appliedL = applyEdits(project, parsedL.patches, parsedL.fullFiles);
      if (appliedL.changed.length) {
        project = appliedL.files;
        for (const path of appliedL.changed) {
          touched.add(path);
          yield { type: "file", path, content: project[path] };
        }
        // Re-lint to confirm rather than assume the edit worked.
        const after = lintLayout(project);
        yield {
          type: "review",
          ok: after.issues.length === 0,
          notes:
            after.issues.length === 0
              ? "Layout defects fixed (re-checked)."
              : `Still unresolved after the fix pass:\n${issuesForPrompt(after.issues)}`,
        };
      }
    }

    // ── COMPLETENESS pass (from-scratch builds) — the reviewer checks the app against the EXPECTED
    // features (not just bugs); anything MISSING is sent back to the coder to ADD (one bounded pass).
    if (fresh && features) {
      yield { type: "status", role: "reviewer", message: "Checking feature completeness…" };
      const reviewRaw = yield* callRole("reviewer", {
        model: pick("reviewer"),
        ...conn,
        // Room to emit ONE checklist entry per expected feature with evidence. At 500 the reviewer
        // physically could not enumerate and defaulted to a one-line rubber stamp; at 1600 it hit the
        // cap mid-list and the truncated JSON was waved through. 3000 + short evidence fits.
        maxTokens: 3000,
        messages: [
          { role: "system", content: SYSTEM.reviewer },
          { role: "user", content: `EXPECTED FEATURES:\n${features}\n\nCURRENT PROJECT:\n${summariseFiles(project)}` },
        ],
      });
      const review = safeJson(reviewRaw);
      if (!review.ok && review.notes) {
        yield { type: "review", ok: false, notes: review.notes };
        yield { type: "status", role: "coder", message: "Adding the missing features…" };
        const add = { files: {} as FileMap, raw: "", opened: false, narration: "" };
        yield* streamCode(
          {
            model: pick("coder"),
            ...conn,
            reasoning: effReasoning,
            messages: [
              { role: "system", content: SYSTEM.coder },
              {
                role: "user",
                content:
                  `ADD the following MISSING or incomplete features to the existing project — implement them FULLY and keep everything already built (don't regress). Output the COMPLETE changed or new files.\n\n` +
                  `MISSING:\n${review.notes}\n\nEXPECTED FEATURES:\n${features}\n\nCURRENT PROJECT:\n${summariseFiles(project)}`,
              },
            ],
          },
          add,
        );
        project = { ...project, ...add.files };
        Object.keys(add.files).forEach((p) => touched.add(p));
        if (add.narration) yield { type: "message", content: add.narration.slice(0, 800) };
      } else {
        yield { type: "review", ok: true, notes: "All expected features present" };
      }
    }

    yield { type: "message", content: fileRecap([...touched], hasProject) };
    yield { type: "done" };
  } catch (e) {
    yield { type: "error", message: e instanceof Error ? e.message : String(e) };
    yield { type: "done" };
  }
}

// The runner sandbox doesn't have the app's npm deps installed, so tsc emits "Cannot find module"
// (TS2307) / "no declaration file" (TS7016) for every imported package — false failures that would
// spin the debug loop pointlessly (the deps DO install for the real preview). Drop those; keep real
// type errors. If nothing real remains, the type-check passes.
function refineVerify(v: { ok: boolean; output: string; timedOut?: boolean } | null): { ok: boolean; output: string; timedOut?: boolean } | null {
  if (!v || v.ok) return v;
  const kept = v.output
    .split("\n")
    .filter((l) => l.trim())
    .filter((l) => !/error TS(2307|7016)\b/.test(l) && !/cannot find module|could not find a declaration file/i.test(l));
  const hasReal = kept.some((l) => /error TS\d+/.test(l));
  return { ok: !hasReal, output: kept.join("\n"), timedOut: v.timedOut };
}

// A short, deterministic recap of the files created/changed — a clear "what I did" close-out.
function fileRecap(paths: string[], hasProject: boolean): string {
  if (!paths.length) return hasProject ? "Done — preview updated." : "Your app is ready — preview on the right.";
  const shown = paths.slice(0, 12).join(", ");
  const verb = hasProject ? "Updated" : "Created";
  return `${verb} ${paths.length} file${paths.length > 1 ? "s" : ""}: ${shown}${paths.length > 12 ? ", …" : ""}. Preview on the right — tell me what to change next.`;
}

// Parse the interviewer's JSON into a validated { intro, questions } (or null if unusable).
function parseQuestions(raw: string): { intro: string; questions: AgentQuestion[] } | null {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const o = JSON.parse(m[0]) as { intro?: string; questions?: unknown };
    const list = Array.isArray(o.questions) ? o.questions : [];
    const questions: AgentQuestion[] = [];
    for (const q of list) {
      const qq = q as { question?: unknown; options?: unknown; multi?: unknown; design?: unknown };
      const question = typeof qq.question === "string" ? qq.question.trim() : "";
      const options = Array.isArray(qq.options) ? qq.options.filter((x): x is string => typeof x === "string").slice(0, 6) : [];
      if (question) questions.push({ question, options, multi: !!qq.multi, design: !!qq.design });
    }
    if (!questions.length) return null;
    return { intro: typeof o.intro === "string" ? o.intro : "A few quick questions to nail your vision:", questions: questions.slice(0, 6) };
  } catch {
    return null;
  }
}

interface ReviewEntry {
  feature?: unknown;
  verdict?: unknown;
  evidence?: unknown;
}

// Salvage a verdict from a reviewer reply that was cut off before its closing brace. Failing OPEN on
// unparseable output would re-create exactly the rubber stamp this whole path exists to prevent: the
// completeness pass DID hit its cap mid-enumeration and got waved through as "all features present".
// If any entry was already emitted as partial/missing, that alone fails the pass.
function salvageReview(raw: string): { ok: boolean; notes: string } | null {
  // The gap must not span into the NEXT entry, or a `present` feature gets tagged with the following
  // entry's failing verdict — so the lazy run explicitly refuses to cross another "feature" key.
  const bad = [
    ...raw.matchAll(/"feature"\s*:\s*"([^"]{0,160})"(?:(?!"feature")[\s\S]){0,240}?"verdict"\s*:\s*"(partial|missing)"/gi),
  ];
  if (!bad.length) return null;
  return { ok: false, notes: bad.map((m) => `- ${m[1]}: ${m[2]}`).join("\n") };
}

function safeJson(raw: string): { ok: boolean; notes: string } {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      const o = JSON.parse(m[0]);
      const notes = String(o.notes || "");
      // Do NOT take the reviewer's own `ok` at face value. It has been observed answering
      // "All expected features present" on a build that was missing four of them — a rubber-stamped
      // pass is worse than no pass, because it silently ends the loop. When the reviewer returned a
      // per-feature checklist, DERIVE the verdict from it: any partial/missing entry fails the pass
      // regardless of what `ok` claims, and the entries become the actionable to-do for the coder.
      const checked: ReviewEntry[] = Array.isArray(o.checked) ? o.checked : [];
      const bad = checked.filter((c) => String(c?.verdict ?? "").toLowerCase() !== "present");
      if (bad.length) {
        const list = bad
          .map((c) => `- ${String(c.feature ?? "?")}: ${String(c.verdict ?? "missing")}${c.evidence ? ` (${String(c.evidence)})` : ""}`)
          .join("\n");
        return { ok: false, notes: notes ? `${notes}\n${list}` : list };
      }
      return { ok: !!o.ok, notes };
    }
  } catch {
    // fall through
  }
  return salvageReview(raw) ?? { ok: true, notes: "" };
}
