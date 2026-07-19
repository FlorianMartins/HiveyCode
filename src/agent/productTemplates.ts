import type { FileMap } from "./types";
import { EXTRA_SEEDS } from "./productSeeds";

// ── Product templates ────────────────────────────────────────────────────────────────────────────
// A registry of common PRODUCT types (not just frameworks). Two levels of help:
//   • `features` — a pre-baked "what a best-in-class version of this has" checklist (additive), used
//     instead of an extra market LLM call → consistent, free, covers EVERY program type.
//   • `files`    — (optional) a rich, ready-to-run seed for the richest categories. When present the
//     coder starts from it and only emits DIFFS to adapt/prune → far fewer tokens, instant preview.
// Seeds are single-file (App.tsx) on top of the STARTER scaffold, which already ships Tailwind (Play
// CDN), lucide-react, framer-motion and clsx — so they render reliably in the Sandpack nodebox.
export interface ProductTemplate {
  id: string;
  label: string;
  keywords: string[]; // matched against the user's prompt to auto-pick the closest template
  features: string; // additive expected-feature checklist for this product type
  files?: FileMap; // optional rich seed (App.tsx) → enables edit-from-template (prune) mode
}

// ── Rich seeds (Tailwind via CDN + lucide, mock data, single App.tsx) ──────────────────────────────

const DASHBOARD_APP = `import { useState } from "react";
import { LayoutDashboard, BarChart3, Users, Settings, Bell, Search, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Activity } from "lucide-react";

const KPIS = [
  { label: "Revenue", value: "$48,290", delta: "+12.4%", up: true, icon: DollarSign },
  { label: "Orders", value: "1,284", delta: "+8.1%", up: true, icon: ShoppingCart },
  { label: "Active users", value: "9,417", delta: "-2.3%", up: false, icon: Users },
  { label: "Conversion", value: "3.9%", delta: "+0.6%", up: true, icon: Activity },
];
const BARS = [40, 62, 48, 78, 66, 90, 72, 84, 58, 96, 70, 88];
const ROWS = [
  { name: "Acme Inc.", plan: "Enterprise", amount: "$1,200", status: "Paid" },
  { name: "Globex", plan: "Pro", amount: "$320", status: "Paid" },
  { name: "Initech", plan: "Pro", amount: "$320", status: "Pending" },
  { name: "Umbrella", plan: "Starter", amount: "$0", status: "Trial" },
  { name: "Stark Ind.", plan: "Enterprise", amount: "$1,200", status: "Paid" },
];
const NAV = [
  { icon: LayoutDashboard, label: "Overview", active: true },
  { icon: BarChart3, label: "Analytics" },
  { icon: Users, label: "Customers" },
  { icon: Settings, label: "Settings" },
];

export default function App() {
  const [nav, setNav] = useState("Overview");
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800 font-sans">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white font-bold">H</div>
          <span className="font-semibold">Hivey</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <button key={n.label} onClick={() => setNav(n.label)}
              className={\`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors \${nav === n.label ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-100"}\`}>
              <n.icon size={17} /> {n.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1">
        <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-6 py-3">
          <h1 className="text-lg font-semibold">{nav}</h1>
          <div className="relative ml-auto hidden sm:block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input placeholder="Search…" className="w-56 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400" />
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><Bell size={17} /></button>
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500" />
        </header>

        <div className="p-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {KPIS.map((k) => (
              <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">{k.label}</span>
                  <k.icon size={18} className="text-slate-400" />
                </div>
                <div className="mt-2 text-2xl font-semibold">{k.value}</div>
                <div className={\`mt-1 flex items-center gap-1 text-xs \${k.up ? "text-emerald-600" : "text-rose-600"}\`}>
                  {k.up ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {k.delta} vs last month
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
              <h2 className="mb-4 font-medium">Revenue</h2>
              <div className="flex h-48 items-end gap-2">
                {BARS.map((b, i) => (
                  <div key={i} className="flex-1 rounded-t bg-indigo-500/80 transition-all hover:bg-indigo-600" style={{ height: \`\${b}%\` }} />
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 font-medium">Traffic sources</h2>
              {[["Direct", 48], ["Search", 32], ["Social", 20]].map(([l, v]) => (
                <div key={l as string} className="mb-3">
                  <div className="mb-1 flex justify-between text-sm"><span>{l}</span><span className="text-slate-500">{v}%</span></div>
                  <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-indigo-500" style={{ width: \`\${v}%\` }} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 p-4 font-medium">Recent invoices</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>{["Customer", "Plan", "Amount", "Status"].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {ROWS.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-slate-600">{r.plan}</td>
                    <td className="px-4 py-3">{r.amount}</td>
                    <td className="px-4 py-3">
                      <span className={\`rounded-full px-2 py-0.5 text-xs \${r.status === "Paid" ? "bg-emerald-50 text-emerald-700" : r.status === "Pending" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}\`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
`;

const LANDING_APP = `import { Rocket, Zap, Shield, BarChart3, Check, Menu, ArrowRight, Star } from "lucide-react";

const FEATURES = [
  { icon: Zap, title: "Lightning fast", body: "Ship in minutes with a build pipeline tuned for speed." },
  { icon: Shield, title: "Secure by default", body: "Best-practice security baked in — nothing to configure." },
  { icon: BarChart3, title: "Insightful analytics", body: "Understand your users with dashboards that matter." },
];
const PLANS = [
  { name: "Starter", price: "$0", feats: ["1 project", "Community support", "Basic analytics"], cta: "Get started" },
  { name: "Pro", price: "$29", feats: ["Unlimited projects", "Priority support", "Advanced analytics", "Custom domain"], cta: "Start free trial", featured: true },
  { name: "Team", price: "$99", feats: ["Everything in Pro", "SSO & roles", "Audit logs", "SLA"], cta: "Contact sales" },
];

export default function App() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-800">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-6 py-4">
          <Rocket className="text-indigo-600" size={22} /><span className="text-lg font-bold">Nova</span>
          <nav className="ml-8 hidden gap-6 text-sm text-slate-600 md:flex">
            {["Product", "Features", "Pricing", "Docs"].map((l) => <a key={l} href="#" className="hover:text-slate-900">{l}</a>)}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <a href="#" className="hidden text-sm text-slate-600 hover:text-slate-900 sm:block">Sign in</a>
            <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Get started</button>
            <Menu className="text-slate-600 md:hidden" size={20} />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"><Star size={12} /> New — v2 is here</span>
        <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">Build products your users love, <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">faster</span>.</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600">The all-in-one platform to design, ship and grow modern software — without the busywork.</p>
        <div className="mt-8 flex justify-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700">Start for free <ArrowRight size={17} /></button>
          <button className="rounded-lg border border-slate-200 px-5 py-3 font-medium hover:bg-slate-50">Live demo</button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-100 p-6 transition-shadow hover:shadow-lg">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><f.icon size={22} /></div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold">Simple, honest pricing</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.name} className={\`rounded-2xl border p-6 \${p.featured ? "border-indigo-600 shadow-xl" : "border-slate-200"}\`}>
              {p.featured && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white">Most popular</span>}
              <h3 className="mt-2 font-semibold">{p.name}</h3>
              <div className="mt-2 text-3xl font-bold">{p.price}<span className="text-base font-normal text-slate-500">/mo</span></div>
              <ul className="mt-4 space-y-2 text-sm">
                {p.feats.map((f) => <li key={f} className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> {f}</li>)}
              </ul>
              <button className={\`mt-6 w-full rounded-lg py-2.5 text-sm font-medium \${p.featured ? "bg-indigo-600 text-white hover:bg-indigo-700" : "border border-slate-200 hover:bg-slate-50"}\`}>{p.cta}</button>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-100 py-10 text-center text-sm text-slate-500">© 2026 Nova. All rights reserved.</footer>
    </div>
  );
}
`;

const KANBAN_APP = `import { useState } from "react";
import { Plus, MoreHorizontal } from "lucide-react";

type Card = { id: number; title: string; tag: string };
type Col = { id: string; title: string; cards: Card[] };
const TAG_COLOR: Record<string, string> = { Design: "bg-violet-100 text-violet-700", Dev: "bg-blue-100 text-blue-700", Bug: "bg-rose-100 text-rose-700", Done: "bg-emerald-100 text-emerald-700" };

const INITIAL: Col[] = [
  { id: "todo", title: "To do", cards: [{ id: 1, title: "Design the landing hero", tag: "Design" }, { id: 2, title: "Set up CI pipeline", tag: "Dev" }] },
  { id: "doing", title: "In progress", cards: [{ id: 3, title: "Build the auth flow", tag: "Dev" }, { id: 4, title: "Fix mobile navbar", tag: "Bug" }] },
  { id: "done", title: "Done", cards: [{ id: 5, title: "Project kickoff", tag: "Done" }] },
];

export default function App() {
  const [cols, setCols] = useState<Col[]>(INITIAL);
  const [drag, setDrag] = useState<{ card: Card; from: string } | null>(null);

  const addCard = (colId: string) => {
    const title = window.prompt("New task:");
    if (!title) return;
    setCols((cs) => cs.map((c) => (c.id === colId ? { ...c, cards: [...c.cards, { id: Date.now(), title, tag: "Dev" }] } : c)));
  };
  const drop = (colId: string) => {
    if (!drag) return;
    setCols((cs) => cs.map((c) => {
      if (c.id === drag.from) c = { ...c, cards: c.cards.filter((k) => k.id !== drag.card.id) };
      if (c.id === colId) c = { ...c, cards: [...c.cards, drag.card] };
      return c;
    }));
    setDrag(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
      <header className="border-b border-slate-200 bg-white px-6 py-4"><h1 className="text-lg font-semibold">Product board</h1></header>
      <div className="flex gap-4 overflow-x-auto p-6">
        {cols.map((col) => (
          <div key={col.id} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(col.id)}
            className="flex w-72 shrink-0 flex-col rounded-xl bg-slate-200/60 p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold">{col.title} <span className="ml-1 text-slate-500">{col.cards.length}</span></h2>
              <MoreHorizontal size={16} className="text-slate-400" />
            </div>
            <div className="flex flex-col gap-2">
              {col.cards.map((card) => (
                <div key={card.id} draggable onDragStart={() => setDrag({ card, from: col.id })}
                  className="cursor-grab rounded-lg bg-white p-3 shadow-sm active:cursor-grabbing">
                  <div className="text-sm">{card.title}</div>
                  <span className={\`mt-2 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium \${TAG_COLOR[card.tag] || "bg-slate-100 text-slate-600"}\`}>{card.tag}</span>
                </div>
              ))}
            </div>
            <button onClick={() => addCard(col.id)} className="mt-2 flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-300/50">
              <Plus size={15} /> Add card
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
`;

const CHAT_APP = `import { useState, useRef, useEffect } from "react";
import { Search, Send, Paperclip, Phone, Video, MoreVertical, Check, CheckCheck } from "lucide-react";
import clsx from "clsx";

type Msg = { id: number; text: string; mine: boolean; time: string; read?: boolean };
type Convo = { id: number; name: string; avatar: string; last: string; time: string; unread: number; online: boolean; messages: Msg[] };

const CONVOS: Convo[] = [
  { id: 1, name: "Sofia Rivera", avatar: "SR", last: "Sounds perfect, see you then!", time: "09:41", unread: 2, online: true,
    messages: [
      { id: 1, text: "Hey! Are we still on for the design review?", mine: false, time: "09:32" },
      { id: 2, text: "Absolutely — 2pm works for me.", mine: true, time: "09:35", read: true },
      { id: 3, text: "Sounds perfect, see you then!", mine: false, time: "09:41" },
    ] },
  { id: 2, name: "Dev Team", avatar: "DT", last: "Marc: pushed the fix", time: "08:58", unread: 0, online: true,
    messages: [{ id: 1, text: "pushed the fix, tests are green", mine: false, time: "08:58" }] },
  { id: 3, name: "Amara Okafor", avatar: "AO", last: "Thanks so much!", time: "Yesterday", unread: 0, online: false,
    messages: [{ id: 1, text: "Thanks so much!", mine: false, time: "Yesterday" }] },
];

function Dot({ d = 0 }: { d?: number }) {
  return <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: d + "s" }} />;
}

export default function App() {
  const [convos, setConvos] = useState<Convo[]>(CONVOS);
  const [activeId, setActiveId] = useState(1);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [q, setQ] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const active = convos.find((c) => c.id === activeId) || convos[0];

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [active.messages.length, typing]);

  const send = () => {
    if (!text.trim()) return;
    const msg: Msg = { id: Date.now(), text: text.trim(), mine: true, time: "now", read: false };
    setConvos((cs) => cs.map((c) => (c.id === activeId ? { ...c, messages: [...c.messages, msg], last: msg.text } : c)));
    setText("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setConvos((cs) => cs.map((c) => (c.id === activeId ? { ...c, messages: [...c.messages, { id: Date.now() + 1, text: "Got it — thanks!", mine: false, time: "now" }] } : c)));
    }, 1600);
  };

  const filtered = convos.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="p-4">
          <h1 className="mb-3 text-lg font-semibold">Messages</h1>
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
            <Search size={15} className="text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-full bg-transparent text-sm outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((c) => (
            <button key={c.id} onClick={() => { setActiveId(c.id); setConvos((cs) => cs.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x))); }}
              className={clsx("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50", activeId === c.id && "bg-indigo-50/60")}>
              <div className="relative">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-semibold text-white">{c.avatar}</div>
                {c.online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between"><span className="truncate text-sm font-medium">{c.name}</span><span className="text-[11px] text-slate-400">{c.time}</span></div>
                <div className="flex items-center justify-between"><span className="truncate text-xs text-slate-500">{c.last}</span>{c.unread > 0 && <span className="ml-2 grid h-5 min-w-5 place-items-center rounded-full bg-indigo-500 px-1 text-[11px] font-semibold text-white">{c.unread}</span>}</div>
              </div>
            </button>
          ))}
        </div>
      </aside>
      <main className="flex flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-semibold text-white">{active.avatar}</div>
          <div className="flex-1"><div className="text-sm font-semibold">{active.name}</div><div className="text-xs text-emerald-600">{active.online ? "Online" : "Offline"}</div></div>
          <Phone size={18} className="cursor-pointer text-slate-400 hover:text-slate-700" />
          <Video size={18} className="cursor-pointer text-slate-400 hover:text-slate-700" />
          <MoreVertical size={18} className="cursor-pointer text-slate-400 hover:text-slate-700" />
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-6 py-4">
          {active.messages.map((m) => (
            <div key={m.id} className={clsx("flex", m.mine ? "justify-end" : "justify-start")}>
              <div className={clsx("max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm", m.mine ? "rounded-br-md bg-indigo-500 text-white" : "rounded-bl-md bg-white text-slate-800")}>
                <div>{m.text}</div>
                <div className={clsx("mt-1 flex items-center justify-end gap-1 text-[10px]", m.mine ? "text-indigo-100" : "text-slate-400")}>{m.time}{m.mine && (m.read ? <CheckCheck size={12} /> : <Check size={12} />)}</div>
              </div>
            </div>
          ))}
          {typing && <div className="flex justify-start"><div className="flex gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm"><Dot /><Dot d={0.15} /><Dot d={0.3} /></div></div>}
          <div ref={endRef} />
        </div>
        <div className="flex items-center gap-2 border-t border-slate-200 bg-white px-4 py-3">
          <Paperclip size={20} className="shrink-0 cursor-pointer text-slate-400 hover:text-slate-600" />
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message…" className="flex-1 rounded-full bg-slate-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
          <button onClick={send} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-500 text-white transition hover:bg-indigo-600"><Send size={17} /></button>
        </div>
      </main>
    </div>
  );
}
`;

const SHOP_APP = `import { useState } from "react";
import { ShoppingBag, Star, Plus, Minus, X, Search, SlidersHorizontal } from "lucide-react";
import clsx from "clsx";

type Product = { id: number; name: string; price: number; cat: string; rating: number; img: string };
const PRODUCTS: Product[] = [
  { id: 1, name: "Aura Wireless Headphones", price: 189, cat: "Audio", rating: 4.8, img: "https://picsum.photos/seed/aurahead/400/400" },
  { id: 2, name: "Minimalist Desk Lamp", price: 64, cat: "Home", rating: 4.6, img: "https://picsum.photos/seed/desklamp/400/400" },
  { id: 3, name: "Trail Runner Sneakers", price: 129, cat: "Shoes", rating: 4.9, img: "https://picsum.photos/seed/trailrun/400/400" },
  { id: 4, name: "Ceramic Pour-Over Set", price: 48, cat: "Home", rating: 4.5, img: "https://picsum.photos/seed/pourover/400/400" },
  { id: 5, name: "Everyday Canvas Backpack", price: 89, cat: "Bags", rating: 4.7, img: "https://picsum.photos/seed/canvasbag/400/400" },
  { id: 6, name: "Smart Fitness Band", price: 99, cat: "Audio", rating: 4.4, img: "https://picsum.photos/seed/fitband/400/400" },
];
const CATS = ["All", "Audio", "Home", "Shoes", "Bags"];

export default function App() {
  const [cat, setCat] = useState("All");
  const [sort, setSort] = useState("featured");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<{ p: Product; qty: number }[]>([]);
  const [open, setOpen] = useState(false);

  const add = (p: Product) => { setCart((c) => { const f = c.find((x) => x.p.id === p.id); return f ? c.map((x) => (x.p.id === p.id ? { ...x, qty: x.qty + 1 } : x)) : [...c, { p, qty: 1 }]; }); setOpen(true); };
  const setQty = (id: number, d: number) => setCart((c) => c.map((x) => (x.p.id === id ? { ...x, qty: Math.max(1, x.qty + d) } : x)));
  const removeItem = (id: number) => setCart((c) => c.filter((x) => x.p.id !== id));

  let shown = PRODUCTS.filter((p) => (cat === "All" || p.cat === cat) && p.name.toLowerCase().includes(q.toLowerCase()));
  if (sort === "low") shown = [...shown].sort((a, b) => a.price - b.price);
  if (sort === "high") shown = [...shown].sort((a, b) => b.price - a.price);
  if (sort === "rating") shown = [...shown].sort((a, b) => b.rating - a.rating);
  const subtotal = cart.reduce((s, x) => s + x.p.price * x.qty, 0);
  const count = cart.reduce((s, x) => s + x.qty, 0);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur">
        <h1 className="text-xl font-bold tracking-tight">lumen<span className="text-indigo-500">.</span></h1>
        <div className="ml-4 hidden flex-1 items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 md:flex">
          <Search size={16} className="text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="w-full bg-transparent text-sm outline-none" />
        </div>
        <button onClick={() => setOpen(true)} className="relative ml-auto grid h-10 w-10 place-items-center rounded-lg hover:bg-slate-100">
          <ShoppingBag size={20} />{count > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-indigo-500 px-1 text-[11px] font-semibold text-white">{count}</span>}
        </button>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={clsx("rounded-full px-4 py-1.5 text-sm font-medium transition", cat === c ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>{c}</button>
          ))}
          <div className="ml-auto flex items-center gap-2 text-sm text-slate-500"><SlidersHorizontal size={15} />
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 outline-none">
              <option value="featured">Featured</option><option value="low">Price: Low to High</option><option value="high">Price: High to Low</option><option value="rating">Top rated</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
          {shown.map((p) => (
            <div key={p.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:shadow-lg">
              <div className="aspect-square overflow-hidden bg-slate-100"><img src={p.img} alt={p.name} className="h-full w-full object-cover transition group-hover:scale-105" /></div>
              <div className="p-4">
                <div className="mb-1 flex items-center gap-1 text-xs text-amber-500"><Star size={13} fill="currentColor" /> {p.rating} <span className="text-slate-400">· {p.cat}</span></div>
                <h3 className="text-sm font-medium">{p.name}</h3>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-semibold">{"$" + p.price}</span>
                  <button onClick={() => add(p)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-600">Add</button>
                </div>
              </div>
            </div>
          ))}
          {!shown.length && <div className="col-span-full py-16 text-center text-sm text-slate-400">No products found.</div>}
        </div>
      </div>

      {open && <div className="fixed inset-0 z-20 bg-black/30" onClick={() => setOpen(false)} />}
      <aside className={clsx("fixed right-0 top-0 z-30 flex h-full w-96 max-w-full flex-col bg-white shadow-2xl transition-transform", open ? "translate-x-0" : "translate-x-full")}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h2 className="font-semibold">Your cart</h2><button onClick={() => setOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-700" /></button></div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {cart.length === 0 && <div className="py-16 text-center text-sm text-slate-400">Your cart is empty.</div>}
          {cart.map((x) => (
            <div key={x.p.id} className="flex gap-3">
              <img src={x.p.img} alt={x.p.name} className="h-16 w-16 rounded-lg object-cover" />
              <div className="flex-1"><div className="text-sm font-medium">{x.p.name}</div><div className="text-xs text-slate-500">{"$" + x.p.price}</div>
                <div className="mt-1 flex items-center gap-2">
                  <button onClick={() => setQty(x.p.id, -1)} className="grid h-6 w-6 place-items-center rounded border border-slate-200 hover:bg-slate-50"><Minus size={12} /></button>
                  <span className="text-sm">{x.qty}</span>
                  <button onClick={() => setQty(x.p.id, 1)} className="grid h-6 w-6 place-items-center rounded border border-slate-200 hover:bg-slate-50"><Plus size={12} /></button>
                  <button onClick={() => removeItem(x.p.id)} className="ml-auto text-xs text-slate-400 hover:text-rose-500">Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 p-5">
          <div className="mb-3 flex items-center justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="text-lg font-semibold">{"$" + subtotal}</span></div>
          <button className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40" disabled={!cart.length}>Checkout</button>
        </div>
      </aside>
    </div>
  );
}
`;

const TODO_APP = `import { useState, useEffect } from "react";
import { Plus, Check, Trash2, Flag, Search, ListTodo } from "lucide-react";
import clsx from "clsx";

type Priority = "low" | "med" | "high";
type Task = { id: number; text: string; done: boolean; priority: Priority; due: string };

const SEED: Task[] = [
  { id: 1, text: "Design the onboarding flow", done: false, priority: "high", due: "Today" },
  { id: 2, text: "Review pull requests", done: false, priority: "med", due: "Tomorrow" },
  { id: 3, text: "Write the release notes", done: true, priority: "low", due: "Mon" },
];
const PRIO: Record<Priority, string> = { high: "text-rose-500", med: "text-amber-500", low: "text-slate-400" };
const KEY = "hivey.todo";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() => { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : SEED; } catch { return SEED; } });
  const [text, setText] = useState("");
  const [prio, setPrio] = useState<Priority>("med");
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");
  const [q, setQ] = useState("");

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(tasks)); } catch {} }, [tasks]);

  const add = () => { if (!text.trim()) return; setTasks((t) => [{ id: Date.now(), text: text.trim(), done: false, priority: prio, due: "Today" }, ...t]); setText(""); };
  const toggle = (id: number) => setTasks((t) => t.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  const remove = (id: number) => setTasks((t) => t.filter((x) => x.id !== id));

  const shown = tasks.filter((t) => (filter === "all" || (filter === "active" ? !t.done : t.done)) && t.text.toLowerCase().includes(q.toLowerCase()));
  const doneCount = tasks.filter((t) => t.done).length;
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 py-10 font-sans text-slate-800">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-500 text-white"><ListTodo size={22} /></div>
          <div><h1 className="text-2xl font-bold">My Tasks</h1><p className="text-sm text-slate-500">{doneCount} of {tasks.length} done · {pct}%</p></div>
        </div>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: pct + "%" }} /></div>

        <div className="mb-4 flex gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add a task…" className="flex-1 bg-transparent px-2 text-sm outline-none" />
          <select value={prio} onChange={(e) => setPrio(e.target.value as Priority)} className="rounded-lg bg-slate-100 px-2 text-sm outline-none">
            <option value="low">Low</option><option value="med">Medium</option><option value="high">High</option>
          </select>
          <button onClick={add} className="flex items-center gap-1 rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-600"><Plus size={16} /> Add</button>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5"><Search size={14} className="text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-32 bg-transparent text-sm outline-none" /></div>
          <div className="ml-auto flex gap-1 rounded-lg bg-slate-200/60 p-1">
            {(["all", "active", "done"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={clsx("rounded-md px-3 py-1 text-sm capitalize transition", filter === f ? "bg-white shadow-sm" : "text-slate-500")}>{f}</button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {shown.map((t) => (
            <div key={t.id} className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <button onClick={() => toggle(t.id)} className={clsx("grid h-5 w-5 shrink-0 place-items-center rounded-md border transition", t.done ? "border-indigo-500 bg-indigo-500 text-white" : "border-slate-300 hover:border-indigo-400")}>{t.done && <Check size={13} />}</button>
              <span className={clsx("flex-1 text-sm", t.done && "text-slate-400 line-through")}>{t.text}</span>
              <span className="text-xs text-slate-400">{t.due}</span>
              <Flag size={14} className={PRIO[t.priority]} />
              <button onClick={() => remove(t.id)} className="text-slate-300 opacity-0 transition hover:text-rose-500 group-hover:opacity-100"><Trash2 size={15} /></button>
            </div>
          ))}
          {!shown.length && <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400">Nothing here yet.</div>}
        </div>
      </div>
    </div>
  );
}
`;

const NOTES_APP = `import { useState, useEffect } from "react";
import { Plus, Search, Trash2, Star, FileText } from "lucide-react";
import clsx from "clsx";

type Note = { id: number; title: string; body: string; fav: boolean; updated: string };
const SEED: Note[] = [
  { id: 1, title: "Welcome to Notebook", body: "This is your space to think. Pick a note on the left, or create a new one. Everything is saved locally in your browser.", fav: true, updated: "Just now" },
  { id: 2, title: "Meeting notes", body: "Ship the beta by Friday. Draft the changelog. Sync with design on the new theme.", fav: false, updated: "2h ago" },
  { id: 3, title: "Ideas", body: "A calmer reading mode. Keyboard shortcuts. Export to markdown.", fav: false, updated: "Yesterday" },
];
const KEY = "hivey.notes";

export default function App() {
  const [notes, setNotes] = useState<Note[]>(() => { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : SEED; } catch { return SEED; } });
  const [activeId, setActiveId] = useState(1);
  const [q, setQ] = useState("");
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch {} }, [notes]);

  const active = notes.find((n) => n.id === activeId) || null;
  const add = () => { const n: Note = { id: Date.now(), title: "Untitled", body: "", fav: false, updated: "Just now" }; setNotes((ns) => [n, ...ns]); setActiveId(n.id); };
  const update = (patch: Partial<Note>) => setNotes((ns) => ns.map((n) => (n.id === activeId ? { ...n, ...patch, updated: "Just now" } : n)));
  const remove = (id: number) => { setNotes((ns) => ns.filter((n) => n.id !== id)); if (id === activeId) setActiveId(notes.find((n) => n.id !== id)?.id || 0); };

  const shown = notes.filter((n) => (n.title + " " + n.body).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 p-4">
          <div className="flex flex-1 items-center gap-2 rounded-lg bg-slate-100 px-3 py-2"><Search size={15} className="text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes" className="w-full bg-transparent text-sm outline-none" /></div>
          <button onClick={add} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-500 text-white hover:bg-indigo-600"><Plus size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {shown.map((n) => (
            <button key={n.id} onClick={() => setActiveId(n.id)} className={clsx("mb-1 w-full rounded-lg px-3 py-2.5 text-left transition", activeId === n.id ? "bg-indigo-50 ring-1 ring-indigo-200" : "hover:bg-slate-50")}>
              <div className="flex items-center gap-1.5"><span className="flex-1 truncate text-sm font-medium">{n.title || "Untitled"}</span>{n.fav && <Star size={13} className="text-amber-400" fill="currentColor" />}</div>
              <div className="truncate text-xs text-slate-400">{n.body.slice(0, 60) || "No text"}</div>
              <div className="mt-0.5 text-[11px] text-slate-300">{n.updated}</div>
            </button>
          ))}
          {!shown.length && <div className="py-12 text-center text-sm text-slate-400">No notes.</div>}
        </div>
      </aside>
      <main className="flex flex-1 flex-col">
        {active ? (
          <>
            <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-6 py-3">
              <span className="text-xs text-slate-400">{active.updated}</span>
              <button onClick={() => update({ fav: !active.fav })} className="ml-auto text-slate-400 hover:text-amber-400"><Star size={17} className={clsx(active.fav && "fill-amber-400 text-amber-400")} /></button>
              <button onClick={() => remove(active.id)} className="text-slate-400 hover:text-rose-500"><Trash2 size={17} /></button>
            </div>
            <div className="flex flex-1 flex-col overflow-y-auto px-8 py-6">
              <input value={active.title} onChange={(e) => update({ title: e.target.value })} placeholder="Untitled" className="w-full bg-transparent text-3xl font-bold outline-none placeholder:text-slate-300" />
              <textarea value={active.body} onChange={(e) => update({ body: e.target.value })} placeholder="Start writing…" className="mt-4 min-h-[300px] flex-1 w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-slate-300" />
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-center text-slate-400"><div><FileText size={40} className="mx-auto mb-3 opacity-40" />Select or create a note</div></div>
        )}
      </main>
    </div>
  );
}
`;

// ── The registry ───────────────────────────────────────────────────────────────────────────────────
export const PRODUCT_TEMPLATES: ProductTemplate[] = [
  {
    id: "dashboard",
    label: "Analytics dashboard",
    keywords: ["dashboard", "analytics", "admin", "kpi", "metrics", "chart", "report", "back office", "backoffice"],
    features:
      "Sidebar navigation, top bar with search + notifications + user menu, a row of KPI stat cards (value + trend delta), at least one chart (bar/line) and one breakdown (progress bars/donut), a sortable/filterable data table with status badges, empty/loading states, fully responsive.",
    files: { "App.tsx": DASHBOARD_APP },
  },
  {
    id: "landing",
    label: "Landing / marketing page",
    keywords: ["landing", "marketing", "homepage", "home page", "saas site", "product page", "waitlist"],
    features:
      "Sticky navbar, a strong hero (headline + subcopy + primary/secondary CTA + badge), a features grid with icons, social proof/testimonials, a 3-tier pricing section, an FAQ, a final CTA band and a footer. Smooth scroll-reveal animations, responsive.",
    files: { "App.tsx": LANDING_APP },
  },
  {
    id: "kanban",
    label: "Kanban board",
    keywords: ["kanban", "board", "trello", "task board", "project board", "backlog", "sprint"],
    features:
      "Multiple columns (To do / In progress / Done), draggable cards between columns, add/edit/delete cards, labels/tags with colors, card counts per column, a header. Persist to localStorage.",
    files: { "App.tsx": KANBAN_APP },
  },
  // Broad coverage via feature checklists (the coder builds a complete version; no seed yet).
  {
    id: "chat",
    label: "Chat / messaging",
    keywords: ["chat", "messaging", "messenger", "conversation", "dm", "inbox", "support chat"],
    features:
      "A conversation list (avatars, last message, unread badges, timestamps), an active thread with message bubbles (sent/received), a composer with send + attachment, typing indicator, online status, search, responsive (list collapses on mobile).",
    files: { "App.tsx": CHAT_APP },
  },
  {
    id: "ecommerce",
    label: "E-commerce storefront",
    keywords: ["e-commerce", "ecommerce", "shop", "store", "storefront", "cart", "checkout", "products", "catalog"],
    features:
      "Product grid with images/price/rating, category filters + sort, product detail with gallery + variants + add-to-cart, a cart drawer with quantities + subtotal, a checkout form, empty-cart state, responsive.",
    files: { "App.tsx": SHOP_APP },
  },
  {
    id: "blog",
    label: "Blog / CMS",
    keywords: ["blog", "cms", "articles", "posts", "news", "magazine", "publication"],
    features:
      "A post list with cover images, title, excerpt, author + date + read time, tags/categories, a featured post, an article reading view with typographic content, search, pagination, responsive.",
    files: EXTRA_SEEDS.blog,
  },
  {
    id: "auth",
    label: "Auth (login / signup)",
    keywords: ["auth", "login", "signup", "sign up", "sign in", "register", "authentication", "password reset"],
    features:
      "Login, sign-up and forgot-password screens, form validation with inline errors, show/hide password, social-login buttons, remember-me, loading/success/error states, a split marketing panel, responsive.",
    files: EXTRA_SEEDS.auth,
  },
  {
    id: "kanban-todo",
    label: "To-do / task app",
    keywords: ["todo", "to-do", "task", "checklist", "tasks app", "reminders"],
    features:
      "Add/edit/delete tasks, complete toggle, due dates + priority, filters (all/active/done) + search, list/board views, progress summary, persist to localStorage, keyboard-friendly, responsive.",
    files: { "App.tsx": TODO_APP },
  },
  {
    id: "notes",
    label: "Notes / knowledge base",
    keywords: ["notes", "note-taking", "notion", "knowledge base", "wiki", "docs app", "editor"],
    features:
      "A notes sidebar (search + folders/tags), a rich text/markdown editor, autosave, pin/favorite, create/rename/delete notes, an empty state, persist to localStorage, responsive.",
    files: { "App.tsx": NOTES_APP },
  },
  {
    id: "calendar",
    label: "Calendar / scheduler",
    keywords: ["calendar", "scheduler", "agenda", "events", "booking", "appointments"],
    features:
      "Month/week/day views, event creation (title/time/color), event details popover, today highlight + navigation, mini-month picker, responsive.",
    files: EXTRA_SEEDS.calendar,
  },
  {
    id: "social",
    label: "Social feed",
    keywords: ["social", "feed", "timeline", "posts feed", "twitter", "instagram", "community"],
    features:
      "A scrollable feed of posts (avatar, name, time, text, media), like/comment/share with counts, a composer to post, a right sidebar (trends/suggestions), profile header, responsive.",
    files: EXTRA_SEEDS.social,
  },
  {
    id: "portfolio",
    label: "Portfolio",
    keywords: ["portfolio", "personal site", "resume", "cv", "showcase", "designer site"],
    features:
      "A hero with name/role, an about section, a projects grid with hover details, skills, experience timeline, a contact form, dark/light toggle, smooth animations, responsive.",
    files: EXTRA_SEEDS.portfolio,
  },
  {
    id: "settings",
    label: "Settings / account",
    keywords: ["settings", "preferences", "account settings", "profile settings", "config", "options page"],
    features:
      "A settings shell with a section nav (Profile, Notifications, Security, Billing, Appearance), forms with labelled inputs, toggle switches, a save button with a saved-confirmation state, avatar upload, responsive.",
    files: EXTRA_SEEDS.settings,
  },
  {
    id: "pricing",
    label: "Pricing page",
    keywords: ["pricing", "plans", "subscription", "tiers", "pricing table", "compare plans"],
    features:
      "A pricing header, a monthly/yearly billing toggle (with a discount badge), 3 plan cards (name, price, description, feature checklist, CTA) with a highlighted 'most popular' plan, responsive.",
    files: EXTRA_SEEDS.pricing,
  },
  {
    id: "music",
    label: "Music player",
    keywords: ["music", "player", "spotify", "audio", "playlist", "podcast player", "streaming"],
    features:
      "A library sidebar, a playlist/track list with artwork + duration, a persistent bottom player bar (play/pause, prev/next, shuffle/repeat, seek bar, volume), now-playing highlight, responsive.",
    files: EXTRA_SEEDS.music,
  },
  {
    id: "weather",
    label: "Weather app",
    keywords: ["weather", "forecast", "meteo", "temperature", "climate"],
    features:
      "A search bar, a current-conditions hero (big temp, icon, hi/lo, wind, humidity), an hourly strip, a multi-city list you can switch between, a nice gradient background, responsive.",
    files: EXTRA_SEEDS.weather,
  },
  {
    id: "email",
    label: "Email client / inbox",
    keywords: ["email", "mail", "inbox", "webmail", "gmail", "outlook", "mail client"],
    features:
      "A folders sidebar (Inbox/Starred/Sent/Archive/Trash with unread counts), a mail list (avatar, sender, subject, preview, time, unread emphasis), a reading pane with reply, a compose button, search, responsive (3-pane collapses).",
    files: EXTRA_SEEDS.email,
  },
  {
    id: "gallery",
    label: "Photo gallery",
    keywords: ["gallery", "photos", "images", "masonry", "portfolio images", "album", "unsplash"],
    features:
      "A responsive masonry grid of images, category filters, hover captions, and a full-screen lightbox with prev/next navigation, like and download actions, responsive.",
    files: EXTRA_SEEDS.gallery,
  },
  {
    id: "filemanager",
    label: "File manager / drive",
    keywords: ["file manager", "files", "drive", "explorer", "dropbox", "google drive", "storage", "documents"],
    features:
      "A folder tree sidebar with storage meter, a breadcrumb, a files area with grid AND list views (icons per type, size, modified), upload button, search, selection, context actions, responsive.",
    files: EXTRA_SEEDS.filemanager,
  },
  {
    id: "crm",
    label: "CRM / sales pipeline",
    keywords: ["crm", "sales", "pipeline", "deals", "leads", "contacts", "customers", "hubspot", "salesforce"],
    features:
      "A deals pipeline with stage columns (Lead → Contacted → Proposal → Won), draggable/movable deal cards (company, contact, value), pipeline total, quick email/call actions, search + new-deal button, responsive.",
    files: EXTRA_SEEDS.crm,
  },
  {
    id: "booking",
    label: "Booking / appointments",
    keywords: ["booking", "appointment", "reservation", "scheduler", "calendly", "reserve", "slots", "rendez-vous"],
    features:
      "A service picker, a day selector, a time-slot grid (with taken/disabled slots), a confirm step and a success confirmation screen. Clean, guided, responsive.",
    files: EXTRA_SEEDS.booking,
  },
  {
    id: "pomodoro",
    label: "Timer / Pomodoro",
    keywords: ["pomodoro", "timer", "countdown", "focus", "stopwatch", "productivity timer"],
    features:
      "Focus/short-break/long-break modes, a circular progress ring, a large MM:SS countdown, start/pause/reset controls, a completed-sessions counter, mode-colored theme, responsive.",
    files: EXTRA_SEEDS.pomodoro,
  },
];

// Pick the closest product template from the prompt (keyword scoring). Returns null below threshold
// so generic requests fall through to the normal from-scratch build.
export function matchProductTemplate(prompt: string): ProductTemplate | null {
  const p = " " + prompt.toLowerCase() + " ";
  let best: ProductTemplate | null = null;
  let bestScore = 0;
  for (const t of PRODUCT_TEMPLATES) {
    let score = 0;
    for (const kw of t.keywords) if (p.includes(" " + kw) || p.includes(kw + " ") || p.includes(kw)) score += kw.length; // longer keyword = stronger signal
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return bestScore >= 4 ? best : null;
}
