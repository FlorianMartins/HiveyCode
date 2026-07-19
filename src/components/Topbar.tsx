"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import { BookMarked, PanelLeft, Settings, Download, Share2, Check } from "lucide-react";
import { MemoryDrawer } from "./MemoryPanel";
import { MenuDrawer } from "./MenuDrawer";
import { SettingsDrawer } from "./SettingsDrawer";
import { downloadProjectZip } from "@/lib/exportZip";
import { useT } from "@/lib/i18n";
import { loadUi, saveUi, applyUi } from "@/lib/uiTheme";
import { applyThemePalette, saveThemePalette } from "@/lib/themeSync";

export function Topbar() {
  const { hydrate, memory, newProject } = useStore();
  const hasFiles = useStore((s) => Object.keys(s.files).length > 0);
  const t = useT();
  const [memOpen, setMemOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [setsOpen, setSetsOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareDone, setShareDone] = useState(false);

  // Read-only share: snapshot the project server-side and copy a public link to the clipboard.
  const shareProject = async () => {
    const st = useStore.getState();
    const files = st.files;
    if (!Object.keys(files).length || sharing) return;
    setSharing(true);
    try {
      const name = st.projects.find((p) => p.id === st.projectId)?.name || "Shared project";
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ files, name }),
      });
      const j = await res.json();
      if (j.url) {
        try { await navigator.clipboard.writeText(j.url); } catch {}
        setShareDone(true);
        window.prompt("Read-only share link (copied to clipboard):", j.url);
        setTimeout(() => setShareDone(false), 2000);
      } else {
        window.alert("Share failed: " + (j.error || "unknown error"));
      }
    } catch (e) {
      window.alert("Share failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSharing(false);
    }
  };

  useEffect(() => hydrate(), [hydrate]);

  // Command palette → "Open settings".
  useEffect(() => {
    const onOpen = () => setSetsOpen(true);
    window.addEventListener("hivey:open-settings", onOpen);
    return () => window.removeEventListener("hivey:open-settings", onOpen);
  }, []);

  // Live key sync from the sidebar bridge — apply the key without a reload.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      // SECURITY: only accept key-sync messages from THIS page's own origin. The sidebar bridge is a
      // content script injected into this page (same origin); the untrusted Sandpack preview iframe is
      // cross-origin, so this rejects any attempt by generated app code to swap the user's API key.
      if (e.origin !== window.location.origin || e.source !== window) return;
      const d = e.data;
      if (!d || d.source !== "hivey-bridge") return;
      if (d.type === "key" && d.key) {
        useStore.getState().setApiKey(d.key);
        useStore.getState().fetchModels();
      }
      if (d.type === "keys" && d.keys) {
        const k = d.keys as Record<string, string>;
        useStore.setState({ keys: k });
        try {
          localStorage.setItem("hivey.keys", JSON.stringify(k));
        } catch {}
        if (k.openrouter) useStore.getState().setApiKey(k.openrouter);
        useStore.getState().fetchModels();
      }
      // Language sync from the sidebar (its uiLang → our UI language).
      if (d.type === "lang" && (d.lang === "en" || d.lang === "fr")) {
        useStore.getState().setLang(d.lang);
      }
      // Appearance sync from the sidebar (colours + auras). The bridge sends a partial UiPrefs; merge
      // it over what we have, persist, and drive the CSS variables live. Accent is store-managed.
      if (d.type === "ui" && d.ui && typeof d.ui === "object") {
        const { accent, ...rest } = d.ui as Record<string, unknown>;
        if (typeof accent === "string") useStore.getState().setAccent(accent);
        if (Object.keys(rest).length) {
          const merged = { ...loadUi(), ...(rest as object) } as ReturnType<typeof loadUi>;
          saveUi(merged);
          applyUi(merged);
        }
      }
      // FULL THEME sync: the bridge sends the sidebar's resolved palette → map to our CSS vars, persist,
      // and re-apply on reload (store hydrate). The whole app follows the sidebar's theme (incl. Light).
      if (d.type === "theme" && d.palette && typeof d.palette === "object") {
        const p = d.palette as Record<string, string>;
        if (typeof p.accent === "string") useStore.getState().setAccent(p.accent);
        applyThemePalette(p);
        saveThemePalette(p);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  return (
    <>
      <MemoryDrawer open={memOpen} onClose={() => setMemOpen(false)} />
      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <SettingsDrawer open={setsOpen} onClose={() => setSetsOpen(false)} />
      <header className="relative z-10 flex items-center gap-2 border-b border-border bg-tool/70 px-3 h-12 shrink-0 backdrop-blur-xl">
      <button
        onClick={() => setMenuOpen((o) => !o)}
        title="Projects & history"
        className={`grid h-8 w-8 place-items-center rounded-lg border transition-colors ${
          menuOpen
            ? "border-accent/40 bg-hivey-grad-soft text-accent shadow-glow"
            : "border-transparent text-muted hover:bg-white/5 hover:text-text"
        }`}
      >
        <PanelLeft size={18} />
      </button>
      <button onClick={() => newProject()} title="Back to home — start a new project" className="font-semibold">
        Hivey <span className="bg-hivey-grad bg-clip-text text-transparent">Code</span>
      </button>

      <button
        onClick={() => setMemOpen(true)}
        title="Project memory — durable facts the agents always know"
        className="ml-auto flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:text-text"
      >
        <BookMarked size={13} />
        {memory.length ? memory.length : ""}
      </button>

      <button
        onClick={shareProject}
        disabled={!hasFiles || sharing}
        title="Create a read-only public link to this project"
        className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-panel hover:text-text disabled:opacity-40"
      >
        {shareDone ? <Check size={16} className="text-accent" /> : <Share2 size={16} />}
      </button>

      <button
        onClick={() => downloadProjectZip(useStore.getState().files)}
        disabled={!hasFiles}
        title={t("topbar.export")}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-panel hover:text-text disabled:opacity-40"
      >
        <Download size={16} />
      </button>

      <button
        onClick={() => setSetsOpen(true)}
        title={t("topbar.settings")}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-panel hover:text-text"
      >
        <Settings size={16} />
      </button>
      </header>
    </>
  );
}
