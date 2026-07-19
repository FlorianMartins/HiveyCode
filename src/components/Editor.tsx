"use client";

import Editor, { type BeforeMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";

// Custom Monaco theme so the editor background matches the app theme (--bg) instead of the grey
// vs-dark default. Read the live CSS variable (honours the user's Appearance settings).
const beforeMount: BeforeMount = (monaco) => {
  let bg = "#0d0d15";
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) bg = v;
  } catch {}
  monaco.editor.defineTheme("hivey-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": bg,
      "editorGutter.background": bg,
      "minimap.background": bg,
      "editorWidget.background": bg,
      "editorStickyScroll.background": bg,
      "breadcrumb.background": bg,
    },
  });
};

const langOf = (path: string) => {
  if (/\.tsx?$/.test(path)) return "typescript";
  if (/\.jsx?$/.test(path)) return "javascript";
  if (/\.css$/.test(path)) return "css";
  if (/\.s[ac]ss$/.test(path)) return "scss";
  if (/\.html?$/.test(path)) return "html";
  if (/\.vue$/.test(path)) return "html";
  if (/\.svelte$/.test(path)) return "html";
  if (/\.json$/.test(path)) return "json";
  if (/\.md$/.test(path)) return "markdown";
  if (/\.py$/.test(path)) return "python";
  if (/\.rs$/.test(path)) return "rust";
  if (/\.go$/.test(path)) return "go";
  if (/\.dart$/.test(path)) return "dart";
  if (/\.(c|h)$/.test(path)) return "c";
  if (/\.(cpp|cc|cxx|hpp)$/.test(path)) return "cpp";
  if (/\.ya?ml$/.test(path)) return "yaml";
  if (/\.toml$/.test(path)) return "plaintext";
  return "plaintext";
};

export function CodeEditor() {
  const { files, activeFile, setFile, saveNow, running } = useStore();
  const revealTarget = useStore((s) => s.revealTarget);
  const content = activeFile ? files[activeFile] ?? "" : "";
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Auto-save: a light debounce persists manual edits to localStorage (no "Save" button).
  useEffect(() => () => clearTimeout(saveTimer.current), []);
  const onEdit = (v: string | undefined) => {
    if (!activeFile) return;
    setFile(activeFile, v ?? "");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNow(), 700);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const edRef = useRef<any>(null);
  const autoScroll = useRef(true); // follow the agent as it writes…
  const programmatic = useRef(false); // …unless the user scrolls (then stop until the next file)

  // A new file started streaming → re-enable follow mode.
  useEffect(() => {
    autoScroll.current = true;
  }, [activeFile]);

  // Jump to a file+line requested elsewhere (multi-file search result / command palette).
  useEffect(() => {
    if (!revealTarget || revealTarget.path !== activeFile) return;
    const ed = edRef.current;
    if (!ed) return;
    autoScroll.current = false; // don't fight the reveal
    const line = Math.max(1, revealTarget.line);
    ed.revealLineInCenter(line);
    ed.setPosition({ lineNumber: line, column: 1 });
    ed.focus();
  }, [revealTarget, activeFile]);

  // While the agent is writing, keep the view pinned to the last line so the code appears live.
  useEffect(() => {
    const ed = edRef.current;
    if (!ed || !running || !autoScroll.current) return;
    const model = ed.getModel?.();
    if (!model) return;
    programmatic.current = true;
    ed.revealLine(model.getLineCount());
    const t = setTimeout(() => (programmatic.current = false), 80);
    return () => clearTimeout(t);
  }, [content, running, activeFile]);

  if (!activeFile) {
    return (
      <div className="flex h-full items-center justify-center text-muted text-sm">
        Select a file, or ask Hivey to build something.
      </div>
    );
  }

  return (
    <Editor
      key={activeFile}
      height="100%"
      theme="hivey-dark"
      beforeMount={beforeMount}
      language={langOf(activeFile)}
      value={content}
      onChange={onEdit}
      onMount={(ed) => {
        edRef.current = ed;
        // If a scroll happens that we didn't trigger, the user took over → stop auto-following.
        ed.onDidScrollChange(() => {
          if (!programmatic.current) autoScroll.current = false;
        });
      }}
      options={{
        fontSize: 13,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        minimap: { enabled: false },
        smoothScrolling: true,
        padding: { top: 12 },
        scrollBeyondLastLine: false,
      }}
    />
  );
}
