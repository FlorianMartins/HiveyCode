"use client";

import { useRef, useState } from "react";
import { useStore } from "@/store/useStore";
import { useT } from "@/lib/i18n";
import { useAgent } from "@/hooks/useAgent";
import { HiveLogo } from "./HiveLogo";
import { InputControls } from "./InputControls";
import { GithubImport } from "./GithubImport";
import type { FileMap } from "@/agent/types";
import { commitProject } from "@/lib/git";
import { buildImport, filesFromInput, filesFromDataTransfer, pickEntry } from "@/lib/importFiles";
import { Popover } from "./Popover";
import { TEMPLATES, getTemplate } from "@/agent/templates";
import {
  GitBranch, ArrowUp, Sparkles, ChevronDown, Check, Upload, FolderUp,
  Atom, Component, Flame, Zap, Braces, FileCode, FileTerminal, FileCode2, Cog, Smartphone, Layers,
  SquareDashed, Triangle, FileType, Coffee, Hash, Gem, Bird, Bot, Send, Puzzle, Server, SquareTerminal,
} from "lucide-react";

// Render a string with **markers** as bold spans (Sider-style key-word emphasis in the tagline).
function renderBold(s: string) {
  return s.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold text-text">{part}</strong> : part,
  );
}

const TPL_ICONS: Record<string, typeof Atom> = { Atom, Component, Flame, Zap, Braces, FileCode, FileTerminal, FileCode2, Cog, Smartphone, SquareDashed, Triangle, FileType, Coffee, Hash, Gem, Bird, Bot, Send, Puzzle, Server, SquareTerminal };
const tplPill = "flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] text-text hover:border-accent hover:bg-white/[0.05]";

function TemplateSelect() {
  const template = useStore((s) => s.template);
  const setTemplate = useStore((s) => s.setTemplate);
  const cur = getTemplate(template);
  const CurIcon = TPL_ICONS[cur.icon] || Layers;
  const customs = TEMPLATES.filter((t) => t.category === "custom");
  const web = TEMPLATES.filter((t) => t.category === "web");
  const domain = TEMPLATES.filter((t) => t.category === "domain");
  const code = TEMPLATES.filter((t) => t.category === "code");

  const Row = ({ id, label, lang, icon }: { id: string; label: string; lang: string; icon: string }) => {
    const Icon = TPL_ICONS[icon] || Layers;
    const on = template === id;
    return (
      <button onClick={() => setTemplate(id)} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-tool ${on ? "text-text" : "text-muted"}`}>
        <Icon size={14} className={`shrink-0 ${on ? "text-accent" : ""}`} />
        <span className="shrink-0 text-[12px]">{label}</span>
        <span className="ml-1 min-w-0 flex-1 text-[10px] leading-tight text-muted">{lang}</span>
        {on && <Check size={12} className="ml-1 shrink-0 text-accent" />}
      </button>
    );
  };

  return (
    <Popover direction="up" width={400} trigger={(o) => <span className={`${tplPill} ${o ? "border-accent" : ""}`}><CurIcon size={13} className="text-accent" /><span className="truncate">{cur.label}</span><ChevronDown size={13} className="opacity-60" /></span>}>
      {() => (
        <div className="flex flex-col">
          <div className="px-2 pt-1 text-[10px] uppercase tracking-wide text-muted">Custom · blank project</div>
          {customs.map((t) => <Row key={t.id} id={t.id} label={t.label} lang={t.lang} icon={t.icon} />)}
          <div className="px-2 pt-2 text-[10px] uppercase tracking-wide text-muted">Web · live preview</div>
          {web.map((t) => <Row key={t.id} id={t.id} label={t.label} lang={t.lang} icon={t.icon} />)}
          <div className="px-2 pt-2 text-[10px] uppercase tracking-wide text-muted">Domains · focused agents</div>
          {domain.map((t) => <Row key={t.id} id={t.id} label={t.label} lang={t.lang} icon={t.icon} />)}
          <div className="px-2 pt-2 text-[10px] uppercase tracking-wide text-muted">Code · scaffold &amp; export (no preview)</div>
          {code.map((t) => <Row key={t.id} id={t.id} label={t.label} lang={t.lang} icon={t.icon} />)}
        </div>
      )}
    </Popover>
  );
}

export function Landing() {
  const { apiKey, running, newProject, setFiles, setActiveFile } = useStore();
  const t = useT();
  const { sendPrompt } = useAgent();
  const [input, setInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [ghOpen, setGhOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const go = (text: string) => {
    if (!text.trim() || running) return;
    sendPrompt(text);
    setInput("");
  };

  // Start a NEW project from imported files/folders/zip. CRUCIAL: no scaffold/template is injected —
  // the project IS the imported files (the orchestrator only seeds STARTER for a truly empty project).
  const startFromFiles = async (fileList: File[]) => {
    if (!fileList.length || running) return;
    setImporting(true);
    try {
      const { files, assets, skipped } = await buildImport(fileList);
      if (!Object.keys(files).length && !assets.length) {
        const why = skipped.length ? "\n\n" + skipped.slice(0, 8).join("\n") + (skipped.length > 8 ? "\n…" : "") : "";
        window.alert("Nothing could be imported." + why);
        return;
      }
      newProject();
      setFiles(files);
      setActiveFile(pickEntry(files));
      commitProject(files, "Import files", useStore.getState().projectId);
      if (skipped.length) {
        const shown = skipped.slice(0, 8).join("\n");
        window.alert(`Imported ${Object.keys(files).length} files` + (assets.length ? ` + ${assets.length} binary asset(s)` : "") + `.\n\nSkipped ${skipped.length}:\n${shown}${skipped.length > 8 ? "\n…" : ""}`);
      }
    } catch (e) {
      window.alert("Import failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setImporting(false);
    }
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (running) return;
    const files = await filesFromDataTransfer(e.dataTransfer);
    startFromFiles(files);
  };

  const onGithubImport = (files: FileMap, label: string) => {
    newProject();
    setFiles(files);
    setActiveFile(Object.keys(files).find((p) => /App\.(t|j)sx?$/.test(p)) || Object.keys(files)[0] || null);
    commitProject(files, `Import ${label}`, useStore.getState().projectId);
    setGhOpen(false);
  };

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden px-6"
      onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={onDrop}
    >
      {/* subtle ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[40rem] -translate-x-1/2 rounded-full bg-accent/10 blur-[130px]" />

      {dragOver && (
        <div className="pointer-events-none absolute inset-4 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-accent bg-hivey-grad-soft/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-text">
            <Upload size={16} /> Drop files or a folder to start a project from them
          </div>
        </div>
      )}

      {/* hidden inputs for the upload buttons */}
      <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => { startFromFiles(filesFromInput(e.currentTarget)); e.currentTarget.value = ""; }} />
      <input
        ref={folderInput}
        type="file"
        className="hidden"
        onChange={(e) => { startFromFiles(filesFromInput(e.currentTarget)); e.currentTarget.value = ""; }}
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
      />

      <div className="relative w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <HiveLogo size={60} />
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">
            Hivey <span className="bg-hivey-grad bg-clip-text text-transparent">Code</span>
          </h1>
          <p className="mt-3 text-[15px] text-muted">{renderBold(t("landing.tagline"))}</p>
        </div>

        {/* prompt box */}
        <div className={`neon composer-box rounded-2xl border border-border p-3 focus-within:border-accent ${running ? "is-busy" : ""}`}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                go(input);
              }
            }}
            rows={3}
            autoFocus
            placeholder={t("landing.placeholder")}
            className="w-full resize-none bg-transparent px-2 pt-1 text-[15px] text-text placeholder:text-muted outline-none"
          />
          <div className="flex flex-wrap items-center gap-2 px-1">
            <TemplateSelect />
            <InputControls hideAsk />
            <button
              onClick={() => go(input)}
              disabled={running || !input.trim()}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-hivey-grad px-3.5 py-2 text-sm font-medium text-on-accent transition-opacity disabled:opacity-50"
            >
              {running ? t("landing.building") : t("landing.build")} <ArrowUp size={15} />
            </button>
          </div>
        </div>

        {!apiKey && (
          <p className="mt-3 text-center text-xs text-muted">
            <Sparkles size={11} className="mb-0.5 inline" /> Add your OpenRouter key (top-right) to start — your key stays in your browser.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => fileInput.current?.click()}
            disabled={importing || running}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-text disabled:opacity-50"
          >
            <Upload size={14} /> Upload files
          </button>
          <button
            onClick={() => folderInput.current?.click()}
            disabled={importing || running}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-text disabled:opacity-50"
          >
            <FolderUp size={14} /> Upload folder
          </button>
          <button
            onClick={() => setGhOpen(true)}
            disabled={importing || running}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-text disabled:opacity-50"
          >
            <GitBranch size={14} /> Import from GitHub
          </button>
        </div>
      </div>
      {ghOpen && <GithubImport onImport={onGithubImport} onClose={() => setGhOpen(false)} />}
    </div>
  );
}
