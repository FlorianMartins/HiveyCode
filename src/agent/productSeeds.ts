import type { FileMap } from "./types";

// 🐝 Extra rich seeds (single-file App.tsx) for common product types that previously had only a
// feature checklist. Same convention as the seeds in productTemplates.ts: Tailwind (Play CDN),
// lucide-react + clsx are pre-installed. The coder STARTS from these and emits only diffs to
// adapt/prune → far fewer output tokens and an instant preview. `clsx` is used for conditional
// classes so the seeds carry no nested template literals.

const AUTH_APP = `import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, Github, Chrome, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import clsx from "clsx";

type Mode = "login" | "signup" | "forgot";

export default function App() {
  const [mode, setMode] = useState<Mode>("login");
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const emailOk = /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email);
  const pwdOk = pwd.length >= 6;
  const canSubmit = emailOk && (mode === "forgot" || pwdOk) && (mode !== "signup" || name.trim().length > 1);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setTimeout(() => { setBusy(false); setDone(true); }, 900);
  }

  const title = mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password";
  const cta = mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link";

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-indigo-600 to-violet-700 p-12 text-white lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck /> Hivey</div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">Build faster.<br />Ship with confidence.</h1>
          <p className="mt-4 max-w-sm text-indigo-100">Everything your team needs in one secure workspace — join thousands of builders today.</p>
        </div>
        <p className="text-sm text-indigo-200">© 2026 Hivey Inc.</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {done ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <CheckCircle2 className="mx-auto text-emerald-500" size={40} />
              <h2 className="mt-4 text-xl font-semibold">{mode === "forgot" ? "Check your inbox" : "You're all set"}</h2>
              <p className="mt-2 text-sm text-slate-500">{mode === "forgot" ? "We sent a reset link to " + email : "Signed in as " + email}</p>
              <button onClick={() => { setDone(false); setMode("login"); }} className="mt-6 text-sm font-medium text-indigo-600 hover:underline">Back to sign in</button>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">{mode === "login" ? "Sign in to continue to your dashboard." : mode === "signup" ? "Start your free 14-day trial." : "We'll email you a secure link."}</p>

              {mode !== "forgot" && (
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium hover:bg-slate-50"><Chrome size={16} /> Google</button>
                  <button className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium hover:bg-slate-50"><Github size={16} /> GitHub</button>
                </div>
              )}
              {mode !== "forgot" && <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><div className="h-px flex-1 bg-slate-200" /> or <div className="h-px flex-1 bg-slate-200" /></div>}

              <form onSubmit={submit} className="space-y-4">
                {mode === "signup" && (
                  <label className="block">
                    <span className="text-sm font-medium">Full name</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="Ada Lovelace" />
                  </label>
                )}
                <label className="block">
                  <span className="text-sm font-medium">Email</span>
                  <div className="relative mt-1">
                    <Mail className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={clsx("w-full rounded-lg border px-9 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-100", email && !emailOk ? "border-rose-400" : "border-slate-300 focus:border-indigo-500")} placeholder="you@company.com" />
                  </div>
                  {email && !emailOk && <span className="mt-1 block text-xs text-rose-500">Enter a valid email address.</span>}
                </label>
                {mode !== "forgot" && (
                  <label className="block">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Password</span>
                      {mode === "login" && <button type="button" onClick={() => setMode("forgot")} className="text-xs font-medium text-indigo-600 hover:underline">Forgot?</button>}
                    </div>
                    <div className="relative mt-1">
                      <Lock className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
                      <input value={pwd} onChange={(e) => setPwd(e.target.value)} type={show ? "text" : "password"} className="w-full rounded-lg border border-slate-300 px-9 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="••••••••" />
                      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    </div>
                  </label>
                )}
                <button disabled={!canSubmit || busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50">
                  {busy ? "Please wait…" : cta} {!busy && <ArrowRight size={16} />}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-500">
                {mode === "login" ? "New here? " : "Already have an account? "}
                <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="font-medium text-indigo-600 hover:underline">{mode === "login" ? "Create an account" : "Sign in"}</button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
`;

const BLOG_APP = `import { useState, useMemo } from "react";
import { Search, Clock, ArrowLeft, ArrowRight, Tag } from "lucide-react";
import clsx from "clsx";

const POSTS = [
  { id: 1, title: "Designing calm software", excerpt: "How restraint and whitespace make products feel effortless and trustworthy.", tag: "Design", author: "Ada Lovelace", date: "Jul 12, 2026", read: 6, cover: "#6366f1", featured: true, body: "Great software gets out of the way. In this piece we explore the principles behind interfaces that feel quiet — generous spacing, a limited palette, and motion used only to explain, never to decorate." },
  { id: 2, title: "Shipping on Fridays", excerpt: "A pragmatic take on release cadence for small, fast-moving teams.", tag: "Engineering", author: "Grace Hopper", date: "Jul 9, 2026", read: 4, cover: "#0ea5e9", body: "Deploy small, deploy often. With good observability and instant rollback, the day of the week matters far less than the size of the change." },
  { id: 3, title: "The economics of tokens", excerpt: "Why starting from a rich template beats generating boilerplate every time.", tag: "AI", author: "Alan Turing", date: "Jul 4, 2026", read: 8, cover: "#10b981", body: "Every generated line has a cost. Seeding a project with a production-ready base and only editing the diff is dramatically cheaper and more consistent." },
  { id: 4, title: "A field guide to empty states", excerpt: "The screens nobody designs are the ones users see first.", tag: "Design", author: "Ada Lovelace", date: "Jun 28, 2026", read: 5, cover: "#f59e0b", body: "An empty state is an opportunity: explain the value, show a sample, and offer one clear action." },
  { id: 5, title: "Type systems for humans", excerpt: "Make the compiler your pair-programmer, not your gatekeeper.", tag: "Engineering", author: "Grace Hopper", date: "Jun 20, 2026", read: 7, cover: "#ec4899", body: "Types should describe intent. When they fight you, it usually means the model is wrong — fix the model, not the types." },
];
const TAGS = ["All", "Design", "Engineering", "AI"];

export default function App() {
  const [tag, setTag] = useState("All");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const list = useMemo(() => POSTS.filter((p) => (tag === "All" || p.tag === tag) && (p.title + p.excerpt).toLowerCase().includes(q.toLowerCase())), [tag, q]);
  const post = POSTS.find((p) => p.id === open);
  const featured = POSTS.find((p) => p.featured);

  if (post) return (
    <div className="min-h-screen bg-white font-sans text-slate-800">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <button onClick={() => setOpen(null)} className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"><ArrowLeft size={16} /> Back to articles</button>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"><Tag size={12} /> {post.tag}</span>
        <h1 className="mt-4 text-3xl font-bold leading-tight">{post.title}</h1>
        <div className="mt-3 flex items-center gap-3 text-sm text-slate-500"><span>{post.author}</span> · <span>{post.date}</span> · <span className="inline-flex items-center gap-1"><Clock size={13} /> {post.read} min</span></div>
        <div className="mt-6 h-56 rounded-2xl" style={{ background: post.cover }} />
        <div className="prose mt-8 max-w-none text-[15px] leading-7 text-slate-700"><p className="text-lg font-medium text-slate-900">{post.excerpt}</p><p className="mt-4">{post.body}</p><p className="mt-4">{post.body}</p></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold">Hivey Journal</span>
          <div className="relative w-64 max-w-[45vw]">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search articles…" className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {featured && tag === "All" && !q && (
          <button onClick={() => setOpen(featured.id)} className="mb-8 grid w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left md:grid-cols-2">
            <div className="h-52 md:h-full" style={{ background: featured.cover }} />
            <div className="p-6">
              <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Featured · {featured.tag}</span>
              <h2 className="mt-2 text-2xl font-bold">{featured.title}</h2>
              <p className="mt-2 text-slate-500">{featured.excerpt}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600">Read article <ArrowRight size={15} /></span>
            </div>
          </button>
        )}

        <div className="mb-6 flex gap-2">
          {TAGS.map((t) => (
            <button key={t} onClick={() => setTag(t)} className={clsx("rounded-full px-4 py-1.5 text-sm font-medium transition", tag === t ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100")}>{t}</button>
          ))}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <button key={p.id} onClick={() => setOpen(p.id)} className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:shadow-md">
              <div className="h-36" style={{ background: p.cover }} />
              <div className="p-4">
                <span className="text-xs font-semibold text-indigo-600">{p.tag}</span>
                <h3 className="mt-1 font-semibold group-hover:text-indigo-700">{p.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.excerpt}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">{p.author} · {p.date} · <span className="inline-flex items-center gap-1"><Clock size={12} /> {p.read}m</span></div>
              </div>
            </button>
          ))}
        </div>
        {list.length === 0 && <p className="py-16 text-center text-slate-400">No articles match your search.</p>}
      </main>
    </div>
  );
}
`;

const CALENDAR_APP = `import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import clsx from "clsx";

type Ev = { id: number; day: number; title: string; time: string; color: string };
const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899"];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function App() {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState<Ev[]>([
    { id: 1, day: 4, title: "Team standup", time: "09:30", color: COLORS[0] },
    { id: 2, day: 4, title: "Design review", time: "14:00", color: COLORS[3] },
    { id: 3, day: 12, title: "Ship v2.0", time: "11:00", color: COLORS[2] },
    { id: 4, day: 18, title: "1:1 with Ada", time: "16:00", color: COLORS[4] },
  ]);
  const [pick, setPick] = useState<number | null>(null);
  const [draft, setDraft] = useState({ title: "", time: "10:00", color: COLORS[0] });

  const y = cursor.getFullYear(), m = cursor.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const isToday = (d: number) => today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;

  function add() {
    if (!draft.title.trim() || pick == null) return;
    setEvents((e) => [...e, { id: Date.now(), day: pick, title: draft.title.trim(), time: draft.time, color: draft.color }]);
    setDraft({ title: "", time: "10:00", color: COLORS[0] });
    setPick(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-800 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{MONTHS[m]} {y}</h1>
          <div className="flex items-center gap-1">
            <button onClick={() => setCursor(new Date(y, m - 1, 1))} className="rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-100"><ChevronLeft size={16} /></button>
            <button onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100">Today</button>
            <button onClick={() => setCursor(new Date(y, m + 1, 1))} className="rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-100"><ChevronRight size={16} /></button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-500">
            {WD.map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => (
              <div key={i} className={clsx("min-h-[92px] border-b border-r border-slate-100 p-1.5", d == null && "bg-slate-50/50")}>
                {d != null && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className={clsx("grid h-6 w-6 place-items-center rounded-full text-xs", isToday(d) ? "bg-indigo-600 font-semibold text-white" : "text-slate-500")}>{d}</span>
                      <button onClick={() => setPick(d)} className="text-slate-300 opacity-0 hover:text-indigo-600 group-hover:opacity-100"><Plus size={14} /></button>
                    </div>
                    <div className="mt-1 space-y-1">
                      {events.filter((e) => e.day === d).map((e) => (
                        <div key={e.id} className="truncate rounded px-1.5 py-0.5 text-[11px] font-medium text-white" style={{ background: e.color }}>{e.time} {e.title}</div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {pick != null && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4" onClick={() => setPick(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-semibold">New event · {MONTHS[m]} {pick}</h3><button onClick={() => setPick(null)}><X size={18} className="text-slate-400" /></button></div>
            <input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Event title" className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
            <div className="mt-3 flex items-center gap-3">
              <input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <div className="flex gap-1.5">{COLORS.map((c) => <button key={c} onClick={() => setDraft({ ...draft, color: c })} className={clsx("h-6 w-6 rounded-full", draft.color === c && "ring-2 ring-offset-2 ring-slate-400")} style={{ background: c }} />)}</div>
            </div>
            <button onClick={add} className="mt-5 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Add event</button>
          </div>
        </div>
      )}
    </div>
  );
}
`;

const SOCIAL_APP = `import { useState } from "react";
import { Heart, MessageCircle, Repeat2, Share, Image as ImageIcon, TrendingUp, Sparkles } from "lucide-react";
import clsx from "clsx";

type Post = { id: number; name: string; handle: string; time: string; text: string; avatar: string; media?: string; likes: number; comments: number; shares: number; liked?: boolean };
const SEED: Post[] = [
  { id: 1, name: "Ada Lovelace", handle: "ada", time: "2h", avatar: "#6366f1", text: "Just shipped a rich-template mode — starting from a production-ready base instead of generating boilerplate. Builds are 3× cheaper now. 🐝", likes: 128, comments: 24, shares: 12 },
  { id: 2, name: "Grace Hopper", handle: "grace", time: "5h", avatar: "#0ea5e9", text: "Reminder: the best debugger is a good night's sleep.", media: "#0ea5e9", likes: 342, comments: 41, shares: 58 },
  { id: 3, name: "Alan Turing", handle: "alan", time: "8h", avatar: "#10b981", text: "Types are just proofs wearing a hat.", likes: 96, comments: 8, shares: 5 },
];
const TRENDS = ["#DesignSystems", "#TokenEconomy", "#ShipFriday", "#WebGPU", "#OpenSource"];
const WHO = [{ name: "Hivey", handle: "hivey", avatar: "#f59e0b" }, { name: "Marie Curie", handle: "marie", avatar: "#ec4899" }];

export default function App() {
  const [posts, setPosts] = useState(SEED);
  const [draft, setDraft] = useState("");
  function like(id: number) { setPosts((p) => p.map((x) => x.id === id ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) } : x)); }
  function post() {
    if (!draft.trim()) return;
    setPosts((p) => [{ id: Date.now(), name: "You", handle: "you", time: "now", avatar: "#8b5cf6", text: draft.trim(), likes: 0, comments: 0, shares: 0 }, ...p]);
    setDraft("");
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
      <div className="mx-auto flex max-w-4xl gap-6 px-4 py-6">
        <main className="flex-1">
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full" style={{ background: "#8b5cf6" }} />
              <div className="flex-1">
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder="What's happening?" className="w-full resize-none text-[15px] outline-none placeholder:text-slate-400" />
                <div className="mt-2 flex items-center justify-between">
                  <button className="text-indigo-500 hover:text-indigo-600"><ImageIcon size={18} /></button>
                  <button onClick={post} disabled={!draft.trim()} className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Post</button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {posts.map((p) => (
              <article key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-full" style={{ background: p.avatar }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-sm"><span className="font-semibold">{p.name}</span><span className="text-slate-400">@{p.handle} · {p.time}</span></div>
                    <p className="mt-1 text-[15px] leading-relaxed">{p.text}</p>
                    {p.media && <div className="mt-3 h-56 rounded-xl" style={{ background: p.media }} />}
                    <div className="mt-3 flex items-center gap-8 text-slate-400">
                      <button onClick={() => like(p.id)} className={clsx("flex items-center gap-1.5 text-sm hover:text-rose-500", p.liked && "text-rose-500")}><Heart size={17} fill={p.liked ? "currentColor" : "none"} /> {p.likes}</button>
                      <button className="flex items-center gap-1.5 text-sm hover:text-sky-500"><MessageCircle size={17} /> {p.comments}</button>
                      <button className="flex items-center gap-1.5 text-sm hover:text-emerald-500"><Repeat2 size={17} /> {p.shares}</button>
                      <button className="hover:text-indigo-500"><Share size={16} /></button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </main>

        <aside className="hidden w-72 shrink-0 space-y-4 lg:block">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="flex items-center gap-2 font-semibold"><TrendingUp size={16} /> Trending</h3>
            <ul className="mt-3 space-y-2">{TRENDS.map((t) => <li key={t} className="cursor-pointer text-sm font-medium text-indigo-600 hover:underline">{t}</li>)}</ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="flex items-center gap-2 font-semibold"><Sparkles size={16} /> Who to follow</h3>
            <ul className="mt-3 space-y-3">{WHO.map((w) => (
              <li key={w.handle} className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full" style={{ background: w.avatar }} />
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{w.name}</div><div className="text-xs text-slate-400">@{w.handle}</div></div>
                <button className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Follow</button>
              </li>
            ))}</ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
`;

const PORTFOLIO_APP = `import { useState } from "react";
import { Github, Linkedin, Mail, ArrowUpRight, Moon, Sun } from "lucide-react";
import clsx from "clsx";

const PROJECTS = [
  { name: "Nimbus", desc: "Realtime weather dashboard with beautiful data viz.", tags: ["React", "D3", "WebGL"], color: "#6366f1" },
  { name: "Orbit", desc: "A calendar that schedules itself around your focus time.", tags: ["TypeScript", "Node"], color: "#10b981" },
  { name: "Palette", desc: "Accessible color-system generator for design teams.", tags: ["Design", "a11y"], color: "#f59e0b" },
  { name: "Ledger", desc: "Privacy-first personal finance, all local.", tags: ["Rust", "WASM"], color: "#ec4899" },
];
const SKILLS = ["TypeScript", "React", "Node.js", "Rust", "Figma", "PostgreSQL", "Tailwind", "WebGL"];
const XP = [
  { role: "Senior Product Engineer", org: "Hivey", period: "2024 — now" },
  { role: "Frontend Lead", org: "Globex", period: "2021 — 2024" },
  { role: "Software Engineer", org: "Initech", period: "2019 — 2021" },
];

export default function App() {
  const [dark, setDark] = useState(true);
  return (
    <div className={clsx("min-h-screen font-sans transition-colors", dark ? "bg-slate-950 text-slate-200" : "bg-white text-slate-800")}>
      <div className="mx-auto max-w-3xl px-6 py-16">
        <header className="flex items-center justify-between">
          <span className="text-lg font-bold">AL.</span>
          <div className="flex items-center gap-4">
            <a className="text-sm hover:text-indigo-400" href="#work">Work</a>
            <a className="text-sm hover:text-indigo-400" href="#about">About</a>
            <button onClick={() => setDark((d) => !d)} className={clsx("rounded-full p-2", dark ? "hover:bg-slate-800" : "hover:bg-slate-100")}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
          </div>
        </header>

        <section className="py-20">
          <p className="text-indigo-400">Hi, I'm</p>
          <h1 className="mt-2 text-5xl font-bold tracking-tight">Ada Lovelace</h1>
          <p className={clsx("mt-4 max-w-xl text-lg", dark ? "text-slate-400" : "text-slate-500")}>Product engineer crafting fast, delightful interfaces. I turn ambiguous ideas into shipped software.</p>
          <div className="mt-6 flex gap-3">
            {[Github, Linkedin, Mail].map((I, i) => (
              <a key={i} className={clsx("rounded-lg border p-2.5 transition", dark ? "border-slate-800 hover:bg-slate-800" : "border-slate-200 hover:bg-slate-100")}><I size={18} /></a>
            ))}
          </div>
        </section>

        <section id="work">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Selected work</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {PROJECTS.map((p) => (
              <div key={p.name} className={clsx("group rounded-2xl border p-5 transition hover:-translate-y-1", dark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-slate-50")}>
                <div className="mb-3 h-1.5 w-10 rounded-full" style={{ background: p.color }} />
                <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{p.name}</h3><ArrowUpRight size={18} className="text-slate-400 transition group-hover:text-indigo-400" /></div>
                <p className={clsx("mt-1 text-sm", dark ? "text-slate-400" : "text-slate-500")}>{p.desc}</p>
                <div className="mt-3 flex flex-wrap gap-2">{p.tags.map((t) => <span key={t} className={clsx("rounded-full px-2.5 py-0.5 text-xs", dark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-600")}>{t}</span>)}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="about" className="grid gap-10 py-20 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Experience</h2>
            <ul className="mt-6 space-y-5">{XP.map((x) => (
              <li key={x.role}><div className="font-medium">{x.role}</div><div className="text-sm text-slate-400">{x.org} · {x.period}</div></li>
            ))}</ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Skills</h2>
            <div className="mt-6 flex flex-wrap gap-2">{SKILLS.map((s) => <span key={s} className={clsx("rounded-lg border px-3 py-1.5 text-sm", dark ? "border-slate-800" : "border-slate-200")}>{s}</span>)}</div>
          </div>
        </section>

        <section className={clsx("rounded-2xl border p-8 text-center", dark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-slate-50")}>
          <h2 className="text-2xl font-bold">Let's build something.</h2>
          <p className={clsx("mt-2", dark ? "text-slate-400" : "text-slate-500")}>Available for select freelance projects.</p>
          <a href="mailto:hi@example.com" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"><Mail size={16} /> Get in touch</a>
        </section>
      </div>
    </div>
  );
}
`;

const SETTINGS_APP = `import { useState } from "react";
import { User, Bell, Lock, CreditCard, Palette, Check } from "lucide-react";
import clsx from "clsx";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Lock },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "appearance", label: "Appearance", icon: Palette },
];

function Toggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return <button onClick={() => set(!on)} className={clsx("relative h-6 w-11 rounded-full transition", on ? "bg-indigo-600" : "bg-slate-300")}><span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", on ? "left-[22px]" : "left-0.5")} /></button>;
}

export default function App() {
  const [tab, setTab] = useState("profile");
  const [emailN, setEmailN] = useState(true);
  const [pushN, setPushN] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your account and preferences.</p>
        <div className="mt-8 grid gap-8 md:grid-cols-[200px_1fr]">
          <nav className="space-y-1">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={clsx("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition", tab === t.id ? "bg-white font-medium text-indigo-700 shadow-sm" : "text-slate-600 hover:bg-slate-100")}>
                <t.icon size={16} /> {t.label}
              </button>
            ))}
          </nav>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            {tab === "profile" && (
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500" />
                  <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50">Change photo</button>
                </div>
                {[["Full name", "Ada Lovelace"], ["Email", "ada@hivey.dev"], ["Bio", "Product engineer."]].map(([l, v]) => (
                  <label key={l} className="block"><span className="text-sm font-medium">{l}</span><input defaultValue={v} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" /></label>
                ))}
              </div>
            )}
            {tab === "notifications" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between"><div><div className="font-medium">Email notifications</div><div className="text-sm text-slate-500">Weekly digest and mentions.</div></div><Toggle on={emailN} set={setEmailN} /></div>
                <div className="flex items-center justify-between"><div><div className="font-medium">Push notifications</div><div className="text-sm text-slate-500">Real-time alerts on this device.</div></div><Toggle on={pushN} set={setPushN} /></div>
              </div>
            )}
            {tab !== "profile" && tab !== "notifications" && <div className="py-12 text-center text-slate-400">The {tab} panel goes here.</div>}
            <div className="mt-8 flex justify-end">
              <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 1500); }} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">{saved ? <><Check size={16} /> Saved</> : "Save changes"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`;

const PRICING_APP = `import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import clsx from "clsx";

const PLANS = [
  { name: "Starter", monthly: 0, desc: "For side projects.", features: ["1 project", "Community support", "1 GB storage"], cta: "Start free" },
  { name: "Pro", monthly: 19, desc: "For growing teams.", features: ["Unlimited projects", "Priority support", "100 GB storage", "Analytics", "Custom domains"], cta: "Start trial", popular: true },
  { name: "Enterprise", monthly: 49, desc: "For organizations.", features: ["Everything in Pro", "SSO & SAML", "Dedicated manager", "SLA 99.9%", "Audit logs"], cta: "Contact sales" },
];

export default function App() {
  const [yearly, setYearly] = useState(false);
  return (
    <div className="min-h-screen bg-slate-950 py-20 font-sans text-slate-200">
      <div className="mx-auto max-w-5xl px-6 text-center">
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-3 py-1 text-sm text-indigo-300"><Sparkles size={14} /> Simple pricing</span>
        <h1 className="mt-4 text-4xl font-bold text-white">Pricing that scales with you</h1>
        <p className="mt-3 text-slate-400">Start free. Upgrade when you're ready. Cancel anytime.</p>

        <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-slate-900 p-1 text-sm">
          <button onClick={() => setYearly(false)} className={clsx("rounded-full px-4 py-1.5 transition", !yearly && "bg-slate-700 text-white")}>Monthly</button>
          <button onClick={() => setYearly(true)} className={clsx("rounded-full px-4 py-1.5 transition", yearly && "bg-slate-700 text-white")}>Yearly <span className="text-emerald-400">-20%</span></button>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PLANS.map((p) => {
            const price = yearly ? Math.round(p.monthly * 12 * 0.8) : p.monthly;
            return (
              <div key={p.name} className={clsx("rounded-2xl border p-6 text-left", p.popular ? "border-indigo-500 bg-slate-900 ring-1 ring-indigo-500" : "border-slate-800 bg-slate-900/50")}>
                {p.popular && <span className="mb-3 inline-block rounded-full bg-indigo-500 px-3 py-1 text-xs font-semibold text-white">Most popular</span>}
                <h3 className="text-lg font-semibold text-white">{p.name}</h3>
                <p className="mt-1 text-sm text-slate-400">{p.desc}</p>
                <div className="mt-4 flex items-end gap-1"><span className="text-4xl font-bold text-white">\${price}</span><span className="mb-1 text-slate-400">/{yearly ? "yr" : "mo"}</span></div>
                <button className={clsx("mt-5 w-full rounded-lg py-2.5 text-sm font-semibold transition", p.popular ? "bg-indigo-600 text-white hover:bg-indigo-700" : "border border-slate-700 text-white hover:bg-slate-800")}>{p.cta}</button>
                <ul className="mt-6 space-y-3 text-sm">{p.features.map((f) => <li key={f} className="flex items-center gap-2 text-slate-300"><Check size={16} className="text-emerald-400" /> {f}</li>)}</ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
`;

const MUSIC_APP = `import { useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Heart, Shuffle, Repeat, Volume2, Search, Home, Library } from "lucide-react";
import clsx from "clsx";

const TRACKS = [
  { title: "Midnight City", artist: "M83", len: "4:03", color: "#6366f1" },
  { title: "Redbone", artist: "Childish Gambino", len: "5:26", color: "#ec4899" },
  { title: "Nightcall", artist: "Kavinsky", len: "4:18", color: "#0ea5e9" },
  { title: "Instant Crush", artist: "Daft Punk", len: "5:37", color: "#10b981" },
  { title: "The Less I Know", artist: "Tame Impala", len: "3:39", color: "#f59e0b" },
];

export default function App() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const cur = TRACKS[i];
  return (
    <div className="flex h-screen flex-col bg-slate-950 font-sans text-slate-200">
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-56 flex-col gap-6 bg-black/40 p-5 md:flex">
          <div className="text-lg font-bold text-white">♫ Hivey Music</div>
          <nav className="space-y-3 text-sm">
            {[["Home", Home], ["Search", Search], ["Library", Library]].map(([l, I]: any) => <button key={l} className="flex items-center gap-3 text-slate-400 hover:text-white"><I size={18} /> {l}</button>)}
          </nav>
        </aside>
        <main className="flex-1 min-h-0 overflow-y-auto bg-gradient-to-b from-indigo-900/40 to-slate-950 p-6">
          <div className="flex items-end gap-5">
            <div className="h-40 w-40 rounded-lg shadow-2xl" style={{ background: cur.color }} />
            <div><div className="text-xs uppercase text-slate-300">Playlist</div><h1 className="text-4xl font-bold text-white">Late Night Drive</h1><p className="mt-1 text-sm text-slate-400">{TRACKS.length} songs</p></div>
          </div>
          <ul className="mt-8 space-y-1">
            {TRACKS.map((t, idx) => (
              <li key={t.title} onClick={() => { setI(idx); setPlaying(true); }} className={clsx("flex cursor-pointer items-center gap-4 rounded-lg px-3 py-2 hover:bg-white/5", idx === i && "bg-white/10")}>
                <span className="w-5 text-sm text-slate-400">{idx + 1}</span>
                <div className="h-10 w-10 rounded" style={{ background: t.color }} />
                <div className="flex-1"><div className={clsx("text-sm font-medium", idx === i ? "text-indigo-300" : "text-white")}>{t.title}</div><div className="text-xs text-slate-400">{t.artist}</div></div>
                <Heart size={15} className="text-slate-500 hover:text-rose-400" />
                <span className="text-sm text-slate-400">{t.len}</span>
              </li>
            ))}
          </ul>
        </main>
      </div>
      <footer className="flex items-center gap-4 border-t border-white/10 bg-black/60 px-4 py-3">
        <div className="flex w-56 items-center gap-3"><div className="h-11 w-11 rounded" style={{ background: cur.color }} /><div className="min-w-0"><div className="truncate text-sm font-medium text-white">{cur.title}</div><div className="truncate text-xs text-slate-400">{cur.artist}</div></div></div>
        <div className="flex flex-1 flex-col items-center gap-1">
          <div className="flex items-center gap-5 text-slate-300">
            <Shuffle size={16} className="hover:text-white" />
            <SkipBack size={18} className="cursor-pointer hover:text-white" onClick={() => setI((i - 1 + TRACKS.length) % TRACKS.length)} />
            <button onClick={() => setPlaying((p) => !p)} className="grid h-9 w-9 place-items-center rounded-full bg-white text-black">{playing ? <Pause size={18} /> : <Play size={18} />}</button>
            <SkipForward size={18} className="cursor-pointer hover:text-white" onClick={() => setI((i + 1) % TRACKS.length)} />
            <Repeat size={16} className="hover:text-white" />
          </div>
          <div className="flex w-full max-w-md items-center gap-2 text-xs text-slate-400"><span>1:24</span><div className="h-1 flex-1 rounded-full bg-white/20"><div className="h-1 w-1/3 rounded-full bg-white" /></div><span>{cur.len}</span></div>
        </div>
        <div className="hidden w-56 items-center justify-end gap-2 text-slate-400 sm:flex"><Volume2 size={16} /><div className="h-1 w-24 rounded-full bg-white/20"><div className="h-1 w-2/3 rounded-full bg-white" /></div></div>
      </footer>
    </div>
  );
}
`;

const WEATHER_APP = `import { useState } from "react";
import { Sun, Cloud, CloudRain, CloudSnow, Wind, Droplets, Search, MapPin } from "lucide-react";

const ICONS: Record<string, any> = { Sun, Cloud, CloudRain, CloudSnow };
const CITIES = [
  { city: "San Francisco", temp: 18, cond: "Cloud", hi: 20, lo: 13, wind: 14, hum: 72 },
  { city: "Tokyo", temp: 27, cond: "Sun", hi: 30, lo: 22, wind: 9, hum: 60 },
  { city: "London", temp: 12, cond: "CloudRain", hi: 14, lo: 8, wind: 22, hum: 88 },
  { city: "Oslo", temp: -2, cond: "CloudSnow", hi: 1, lo: -6, wind: 11, hum: 79 },
];
const HOURS = [["Now", 18, "Cloud"], ["13h", 19, "Sun"], ["14h", 20, "Sun"], ["15h", 19, "Cloud"], ["16h", 18, "CloudRain"], ["17h", 16, "CloudRain"]];

export default function App() {
  const [i, setI] = useState(0);
  const w = CITIES[i];
  const Icon = ICONS[w.cond];
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-500 to-indigo-700 p-4 font-sans text-white sm:p-8">
      <div className="mx-auto max-w-md">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 text-white/70" size={18} />
          <input placeholder="Search city…" className="w-full rounded-2xl border border-white/20 bg-white/10 py-2.5 pl-10 pr-3 text-sm outline-none backdrop-blur placeholder:text-white/60" />
        </div>

        <div className="mt-6 rounded-3xl border border-white/20 bg-white/10 p-8 text-center backdrop-blur">
          <div className="flex items-center justify-center gap-1 text-sm text-white/80"><MapPin size={14} /> {w.city}</div>
          <Icon size={72} className="mx-auto mt-4" />
          <div className="mt-2 text-6xl font-bold">{w.temp}°</div>
          <div className="text-white/80">{w.cond.replace("Cloud", "Cloudy").replace("Rain", " rain").replace("Snow", " snow")}</div>
          <div className="mt-1 text-sm text-white/70">H:{w.hi}°  L:{w.lo}°</div>
          <div className="mt-6 flex justify-around border-t border-white/20 pt-4 text-sm">
            <div className="flex items-center gap-2"><Wind size={16} /> {w.wind} km/h</div>
            <div className="flex items-center gap-2"><Droplets size={16} /> {w.hum}%</div>
          </div>
        </div>

        <div className="mt-4 flex gap-3 overflow-x-auto rounded-3xl border border-white/20 bg-white/10 p-4 backdrop-blur">
          {HOURS.map(([h, tp, c]: any) => { const HI = ICONS[c]; return (
            <div key={h} className="flex min-w-[56px] flex-col items-center gap-2 text-sm"><span className="text-white/70">{h}</span><HI size={20} /><span className="font-medium">{tp}°</span></div>
          ); })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {CITIES.map((c, idx) => { const CI = ICONS[c.cond]; return (
            <button key={c.city} onClick={() => setI(idx)} className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/10 p-3 text-left backdrop-blur hover:bg-white/20"><div><div className="text-sm font-medium">{c.city}</div><div className="text-xs text-white/70">{c.cond}</div></div><div className="flex items-center gap-2"><CI size={18} /><span className="font-semibold">{c.temp}°</span></div></button>
          ); })}
        </div>
      </div>
    </div>
  );
}
`;

const EMAIL_APP = `import { useState } from "react";
import { Inbox, Star, Send, Trash2, Search, Archive, Reply } from "lucide-react";
import clsx from "clsx";

const MAILS = [
  { id: 1, from: "Ada Lovelace", subject: "Re: Q3 roadmap review", preview: "Thanks for the notes — I pushed the analytics milestone to next sprint…", time: "9:42", unread: true, star: true, color: "#6366f1" },
  { id: 2, from: "GitHub", subject: "[hivey] 3 new pull requests", preview: "Alan opened #482: Add rich template seeds. Grace approved #479…", time: "8:15", unread: true, color: "#0f172a" },
  { id: 3, from: "Grace Hopper", subject: "Lunch Thursday?", preview: "Want to grab lunch and talk about the compiler rewrite?", time: "Yesterday", color: "#10b981" },
  { id: 4, from: "Stripe", subject: "Your July invoice", preview: "Your receipt for $19.00 is attached. Thanks for being a customer.", time: "Jul 1", color: "#635bff" },
];
const FOLDERS = [["Inbox", Inbox, 2], ["Starred", Star, 0], ["Sent", Send, 0], ["Archive", Archive, 0], ["Trash", Trash2, 0]];

export default function App() {
  const [sel, setSel] = useState<number | null>(1);
  const mail = MAILS.find((m) => m.id === sel);
  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <aside className="hidden w-52 flex-col border-r border-slate-200 bg-white p-3 sm:flex">
        <button className="mb-4 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Compose</button>
        <nav className="space-y-1">
          {FOLDERS.map(([l, I, n]: any) => (
            <button key={l} className={clsx("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm", l === "Inbox" ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-100")}><I size={16} /> <span className="flex-1 text-left">{l}</span>{n > 0 && <span className="rounded-full bg-indigo-600 px-1.5 text-xs text-white">{n}</span>}</button>
          ))}
        </nav>
      </aside>

      <div className="w-full max-w-sm border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-3"><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={15} /><input placeholder="Search mail" className="w-full rounded-lg bg-slate-100 py-2 pl-9 pr-3 text-sm outline-none" /></div></div>
        <ul className="divide-y divide-slate-100">
          {MAILS.map((m) => (
            <li key={m.id} onClick={() => setSel(m.id)} className={clsx("cursor-pointer p-3 hover:bg-slate-50", sel === m.id && "bg-indigo-50/60")}>
              <div className="flex items-center gap-2"><div className="h-8 w-8 rounded-full" style={{ background: m.color }} /><span className={clsx("flex-1 truncate text-sm", m.unread ? "font-semibold" : "font-medium text-slate-600")}>{m.from}</span><span className="text-xs text-slate-400">{m.time}</span></div>
              <div className={clsx("mt-1 truncate text-sm", m.unread ? "font-medium" : "text-slate-500")}>{m.subject}</div>
              <div className="truncate text-xs text-slate-400">{m.preview}</div>
            </li>
          ))}
        </ul>
      </div>

      <main className="hidden flex-1 flex-col md:flex">
        {mail ? (
          <>
            <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-4"><h2 className="flex-1 text-lg font-semibold">{mail.subject}</h2><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Archive size={17} /></button><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Trash2 size={17} /></button></div>
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
              <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full" style={{ background: mail.color }} /><div><div className="font-medium">{mail.from}</div><div className="text-sm text-slate-400">to me · {mail.time}</div></div></div>
              <p className="mt-6 leading-7 text-slate-700">{mail.preview}</p>
              <p className="mt-4 leading-7 text-slate-700">Best,<br />{mail.from}</p>
              <button className="mt-8 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"><Reply size={15} /> Reply</button>
            </div>
          </>
        ) : <div className="grid flex-1 place-items-center text-slate-400">Select an email to read</div>}
      </main>
    </div>
  );
}
`;

const GALLERY_APP = `import { useState } from "react";
import { X, Heart, Download, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";

const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#3b82f6", "#a855f7", "#22c55e"];
const PHOTOS = COLORS.map((c, i) => ({ id: i, color: c, title: ["Sunset", "Ocean", "Forest", "Desert", "Bloom", "Aurora", "Canyon", "Lagoon", "Dune", "Sky", "Nebula", "Meadow"][i], tall: i % 5 === 0 || i % 7 === 0 }));
const CATS = ["All", "Nature", "Travel", "Abstract"];

export default function App() {
  const [cat, setCat] = useState("All");
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold">Gallery</h1><p className="text-sm text-slate-500">{PHOTOS.length} photos</p></div>
          <div className="flex gap-2">{CATS.map((c) => <button key={c} onClick={() => setCat(c)} className={clsx("rounded-full px-3 py-1.5 text-sm font-medium transition", cat === c ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-200")}>{c}</button>)}</div>
        </div>
        <div className="mt-6 columns-2 gap-4 sm:columns-3 lg:columns-4">
          {PHOTOS.map((p) => (
            <button key={p.id} onClick={() => setOpen(p.id)} className="group relative mb-4 block w-full overflow-hidden rounded-xl" style={{ height: p.tall ? 240 : 160, background: p.color }}>
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/50 to-transparent p-3 opacity-0 transition group-hover:opacity-100"><span className="text-sm font-medium text-white">{p.title}</span></div>
            </button>
          ))}
        </div>
      </div>

      {open != null && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(null)}>
          <button className="absolute left-4 text-white/70 hover:text-white" onClick={(e) => { e.stopPropagation(); setOpen((open - 1 + PHOTOS.length) % PHOTOS.length); }}><ChevronLeft size={32} /></button>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="h-[60vh]" style={{ background: PHOTOS[open].color }} />
            <div className="flex items-center justify-between bg-white p-4"><span className="font-medium">{PHOTOS[open].title}</span><div className="flex gap-2 text-slate-500"><button className="hover:text-rose-500"><Heart size={18} /></button><button className="hover:text-indigo-500"><Download size={18} /></button></div></div>
          </div>
          <button className="absolute right-4 text-white/70 hover:text-white" onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % PHOTOS.length); }}><ChevronRight size={32} /></button>
          <button className="absolute right-4 top-4 text-white/70 hover:text-white" onClick={() => setOpen(null)}><X size={26} /></button>
        </div>
      )}
    </div>
  );
}
`;

const FILES_APP = `import { useState } from "react";
import { Folder, FileText, Image as ImageIcon, FileCode, Search, Grid, List, Upload, Star, MoreVertical, ChevronRight } from "lucide-react";
import clsx from "clsx";

const ICON: Record<string, any> = { folder: Folder, doc: FileText, img: ImageIcon, code: FileCode };
const ITEMS = [
  { name: "Projects", type: "folder", size: "—", modified: "Jul 10", color: "#6366f1" },
  { name: "Designs", type: "folder", size: "—", modified: "Jul 8", color: "#ec4899" },
  { name: "Invoices", type: "folder", size: "—", modified: "Jul 2", color: "#f59e0b" },
  { name: "roadmap.pdf", type: "doc", size: "2.4 MB", modified: "Jul 12" },
  { name: "hero.png", type: "img", size: "1.1 MB", modified: "Jul 11", color: "#0ea5e9" },
  { name: "index.tsx", type: "code", size: "8 KB", modified: "Jul 11" },
  { name: "notes.md", type: "doc", size: "3 KB", modified: "Jul 9" },
  { name: "logo.svg", type: "img", size: "12 KB", modified: "Jul 5", color: "#10b981" },
];
const TREE = [["My Drive", true], ["Shared with me", false], ["Recent", false], ["Starred", false], ["Trash", false]];

export default function App() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <aside className="hidden w-56 flex-col border-r border-slate-200 bg-white p-3 sm:flex">
        <button className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"><Upload size={16} /> Upload</button>
        <nav className="space-y-1">
          {TREE.map(([l, active]: any) => <button key={l} className={clsx("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm", active ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-100")}><Folder size={16} /> {l}</button>)}
        </nav>
        <div className="mt-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-500"><div className="mb-1 font-medium text-slate-700">7.2 GB of 15 GB</div><div className="h-1.5 rounded-full bg-slate-200"><div className="h-1.5 w-1/2 rounded-full bg-indigo-500" /></div></div>
      </aside>

      <main className="flex-1 min-h-0 overflow-y-auto">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
          <div className="flex items-center gap-1 text-sm text-slate-500"><span className="font-medium text-slate-800">My Drive</span> <ChevronRight size={14} /> <span>Files</span></div>
          <div className="relative ml-auto"><Search className="pointer-events-none absolute left-3 top-2 text-slate-400" size={15} /><input placeholder="Search files" className="w-56 rounded-lg bg-slate-100 py-1.5 pl-9 pr-3 text-sm outline-none" /></div>
          <div className="flex rounded-lg border border-slate-200"><button onClick={() => setView("grid")} className={clsx("p-1.5", view === "grid" && "text-indigo-600")}><Grid size={16} /></button><button onClick={() => setView("list")} className={clsx("p-1.5", view === "list" && "text-indigo-600")}><List size={16} /></button></div>
        </header>

        <div className="p-6">
          {view === "grid" ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {ITEMS.map((it) => { const I = ICON[it.type]; return (
                <button key={it.name} onClick={() => setSel(it.name)} className={clsx("group rounded-xl border p-4 text-left transition hover:shadow-md", sel === it.name ? "border-indigo-400 bg-indigo-50/40" : "border-slate-200 bg-white")}>
                  <I size={30} style={{ color: it.color || "#94a3b8" }} />
                  <div className="mt-3 truncate text-sm font-medium">{it.name}</div>
                  <div className="text-xs text-slate-400">{it.size} · {it.modified}</div>
                </button>
              ); })}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-400"><tr>{["Name", "Size", "Modified", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>{ITEMS.map((it) => { const I = ICON[it.type]; return (
                <tr key={it.name} onClick={() => setSel(it.name)} className={clsx("cursor-pointer border-t border-slate-100 hover:bg-slate-50", sel === it.name && "bg-indigo-50/40")}>
                  <td className="flex items-center gap-3 px-3 py-2.5 font-medium"><I size={18} style={{ color: it.color || "#94a3b8" }} /> {it.name}</td>
                  <td className="px-3 py-2.5 text-slate-500">{it.size}</td><td className="px-3 py-2.5 text-slate-500">{it.modified}</td>
                  <td className="px-3 py-2.5 text-slate-400"><MoreVertical size={16} /></td>
                </tr>
              ); })}</tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
`;

const CRM_APP = `import { useState } from "react";
import { Search, Plus, Mail, Phone, MoreHorizontal, DollarSign } from "lucide-react";

const STAGES = ["Lead", "Contacted", "Proposal", "Won"];
const COLORS: Record<string, string> = { Lead: "#94a3b8", Contacted: "#0ea5e9", Proposal: "#f59e0b", Won: "#10b981" };
const SEED = [
  { id: 1, name: "Acme Inc.", contact: "Jane Doe", value: 12000, stage: "Lead", color: "#6366f1" },
  { id: 2, name: "Globex", contact: "John Smith", value: 8400, stage: "Contacted", color: "#ec4899" },
  { id: 3, name: "Initech", contact: "Milton W.", value: 5600, stage: "Contacted", color: "#f59e0b" },
  { id: 4, name: "Umbrella", contact: "Alice B.", value: 22000, stage: "Proposal", color: "#0ea5e9" },
  { id: 5, name: "Stark Ind.", contact: "Tony S.", value: 45000, stage: "Won", color: "#10b981" },
  { id: 6, name: "Wayne Ent.", contact: "Bruce W.", value: 30000, stage: "Proposal", color: "#8b5cf6" },
];

export default function App() {
  const [deals, setDeals] = useState(SEED);
  const total = deals.reduce((s, d) => s + d.value, 0);
  function move(id: number, dir: number) {
    setDeals((ds) => ds.map((d) => { if (d.id !== id) return d; const i = STAGES.indexOf(d.stage) + dir; return { ...d, stage: STAGES[Math.max(0, Math.min(STAGES.length - 1, i))] }; }));
  }
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-lg font-semibold">Deals</h1>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">\${total.toLocaleString()} pipeline</span>
        <div className="relative ml-auto"><Search className="pointer-events-none absolute left-3 top-2 text-slate-400" size={15} /><input placeholder="Search deals" className="w-56 rounded-lg bg-slate-100 py-1.5 pl-9 pr-3 text-sm outline-none" /></div>
        <button className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"><Plus size={16} /> New deal</button>
      </header>

      <div className="grid gap-4 overflow-x-auto p-6 lg:grid-cols-4">
        {STAGES.map((stage) => {
          const col = deals.filter((d) => d.stage === stage);
          return (
            <div key={stage} className="min-w-[240px]">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[stage] }} /> {stage}</div>
                <span className="text-sm text-slate-400">{col.length}</span>
              </div>
              <div className="space-y-3">
                {col.map((d) => (
                  <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-lg text-xs font-bold text-white" style={{ background: d.color }}>{d.name[0]}</div><div className="flex-1 text-sm font-medium">{d.name}</div><MoreHorizontal size={16} className="text-slate-400" /></div>
                    <div className="mt-2 text-xs text-slate-500">{d.contact}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600"><DollarSign size={14} />{d.value.toLocaleString()}</span>
                      <div className="flex gap-1 text-slate-400"><button className="hover:text-indigo-500"><Mail size={14} /></button><button className="hover:text-indigo-500"><Phone size={14} /></button></div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => move(d.id, -1)} className="flex-1 rounded border border-slate-200 py-1 text-xs hover:bg-slate-50">←</button>
                      <button onClick={() => move(d.id, 1)} className="flex-1 rounded border border-slate-200 py-1 text-xs hover:bg-slate-50">→</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
`;

const BOOKING_APP = `import { useState } from "react";
import { Clock, Check, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import clsx from "clsx";

const SERVICES = [
  { name: "Haircut", dur: "45 min", price: 35, color: "#6366f1" },
  { name: "Beard trim", dur: "20 min", price: 18, color: "#f59e0b" },
  { name: "Full styling", dur: "1h 15", price: 60, color: "#ec4899" },
];
const DAYS = ["Mon 14", "Tue 15", "Wed 16", "Thu 17", "Fri 18"];
const SLOTS = ["09:00", "09:45", "10:30", "11:15", "13:00", "13:45", "14:30", "15:15", "16:00"];
const TAKEN = ["10:30", "13:45", "16:00"];

export default function App() {
  const [svc, setSvc] = useState(0);
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-6 font-sans">
      <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600"><Check size={28} /></div>
        <h2 className="mt-4 text-xl font-semibold">Booking confirmed</h2>
        <p className="mt-2 text-sm text-slate-500">{SERVICES[svc].name} · {DAYS[day]} at {slot}</p>
        <button onClick={() => { setDone(false); setSlot(null); }} className="mt-6 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Book another</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-800 sm:p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">Book an appointment</h1>
        <p className="mt-1 text-sm text-slate-500">Pick a service, day and time.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {SERVICES.map((s, i) => (
            <button key={s.name} onClick={() => setSvc(i)} className={clsx("rounded-xl border p-4 text-left transition", svc === i ? "border-indigo-500 bg-white ring-1 ring-indigo-500" : "border-slate-200 bg-white hover:border-slate-300")}>
              <div className="h-1.5 w-8 rounded-full" style={{ background: s.color }} />
              <div className="mt-3 font-medium">{s.name}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500"><Clock size={13} /> {s.dur} · \${s.price}</div>
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium"><Calendar size={16} /> Select a day</div>
            <div className="flex gap-1"><button className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50"><ChevronLeft size={15} /></button><button className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50"><ChevronRight size={15} /></button></div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {DAYS.map((d, i) => <button key={d} onClick={() => setDay(i)} className={clsx("min-w-[72px] rounded-lg border px-3 py-2 text-sm font-medium", day === i ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 hover:bg-slate-50")}>{d}</button>)}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {SLOTS.map((t) => { const taken = TAKEN.includes(t); return (
              <button key={t} disabled={taken} onClick={() => setSlot(t)} className={clsx("rounded-lg border py-2 text-sm", taken ? "cursor-not-allowed border-slate-100 text-slate-300 line-through" : slot === t ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-200 hover:border-indigo-300")}>{t}</button>
            ); })}
          </div>
          <button disabled={!slot} onClick={() => setDone(true)} className="mt-6 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{slot ? "Confirm booking · " + slot : "Choose a time"}</button>
        </div>
      </div>
    </div>
  );
}
`;

const POMODORO_APP = `import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Coffee, Brain, Check } from "lucide-react";
import clsx from "clsx";

const MODES = { focus: { label: "Focus", mins: 25, color: "#6366f1", icon: Brain }, short: { label: "Short break", mins: 5, color: "#10b981", icon: Coffee }, long: { label: "Long break", mins: 15, color: "#0ea5e9", icon: Coffee } };
type ModeKey = keyof typeof MODES;

export default function App() {
  const [mode, setMode] = useState<ModeKey>("focus");
  const [left, setLeft] = useState(MODES.focus.mins * 60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (running) {
      ref.current = window.setInterval(() => setLeft((l) => {
        if (l <= 1) { setRunning(false); if (mode === "focus") setDone((d) => d + 1); return 0; }
        return l - 1;
      }), 1000);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running, mode]);

  function pick(m: ModeKey) { setMode(m); setLeft(MODES[m].mins * 60); setRunning(false); }
  function reset() { setLeft(MODES[mode].mins * 60); setRunning(false); }
  const total = MODES[mode].mins * 60;
  const pct = ((total - left) / total) * 100;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const M = MODES[mode];

  return (
    <div className="grid min-h-screen place-items-center p-6 font-sans transition-colors" style={{ background: M.color + "12" }}>
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex gap-1 rounded-full bg-white p-1 shadow-sm">
          {(Object.keys(MODES) as ModeKey[]).map((k) => <button key={k} onClick={() => pick(k)} className={clsx("rounded-full px-4 py-1.5 text-sm font-medium transition", mode === k ? "text-white" : "text-slate-500")} style={mode === k ? { background: MODES[k].color } : undefined}>{MODES[k].label}</button>)}
        </div>

        <div className="relative mx-auto mt-8 grid h-64 w-64 place-items-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" strokeWidth="6" /><circle cx="50" cy="50" r="45" fill="none" stroke={M.color} strokeWidth="6" strokeLinecap="round" strokeDasharray={283} strokeDashoffset={283 - (283 * pct) / 100} style={{ transition: "stroke-dashoffset 1s linear" }} /></svg>
          <div><div className="text-6xl font-bold tabular-nums text-slate-800">{mm}:{ss}</div><div className="mt-1 flex items-center justify-center gap-1 text-sm text-slate-500"><M.icon size={15} /> {M.label}</div></div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-4">
          <button onClick={reset} className="grid h-12 w-12 place-items-center rounded-full bg-white text-slate-500 shadow hover:text-slate-800"><RotateCcw size={18} /></button>
          <button onClick={() => setRunning((r) => !r)} className="grid h-16 w-16 place-items-center rounded-full text-white shadow-lg" style={{ background: M.color }}>{running ? <Pause size={26} /> : <Play size={26} className="ml-1" />}</button>
          <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-sm font-semibold text-slate-600 shadow">{done}</div>
        </div>
        <p className="mt-6 flex items-center justify-center gap-1 text-sm text-slate-500"><Check size={14} /> {done} focus sessions today</p>
      </div>
    </div>
  );
}
`;

export const EXTRA_SEEDS: Record<string, FileMap> = {
  auth: { "App.tsx": AUTH_APP },
  blog: { "App.tsx": BLOG_APP },
  calendar: { "App.tsx": CALENDAR_APP },
  social: { "App.tsx": SOCIAL_APP },
  portfolio: { "App.tsx": PORTFOLIO_APP },
  settings: { "App.tsx": SETTINGS_APP },
  pricing: { "App.tsx": PRICING_APP },
  music: { "App.tsx": MUSIC_APP },
  weather: { "App.tsx": WEATHER_APP },
  email: { "App.tsx": EMAIL_APP },
  gallery: { "App.tsx": GALLERY_APP },
  filemanager: { "App.tsx": FILES_APP },
  crm: { "App.tsx": CRM_APP },
  booking: { "App.tsx": BOOKING_APP },
  pomodoro: { "App.tsx": POMODORO_APP },
};
