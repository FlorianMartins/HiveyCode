"use client";

import { useEffect, useRef, useState } from "react";
import { SandpackPreview, useSandpack, type SandpackPreviewRef } from "@codesandbox/sandpack-react";
import { useStore } from "@/store/useStore";
import { Monitor, Smartphone, RotateCw } from "lucide-react";

// as "Runtime error in the preview".
const SANDBOX_NOISE = /failed to get shell|shell by id|nodebox|bundler .*reset|dangerouslyreset|iframe .*not (loaded|ready)|command failed with a non-zero|listener|is read-only/i;

export function ErrorWatcher() {
  const { sandpack } = useSandpack();
  const setRuntimeError = useStore((s) => s.setRuntimeError);
  const raw = sandpack.error?.message || null;
  const err = raw && SANDBOX_NOISE.test(raw) ? null : raw;
  useEffect(() => {
    setRuntimeError(err);
  }, [err, setRuntimeError]);
  return null;
}

// When a build finishes, force Sandpack to recompile the FINAL files and reload the preview iframe —
// otherwise it can stay on a stale/errored intermediate state (from the mid-stream partial files) and
// the user has to refresh manually.
export function PreviewRefresher() {
  const { sandpack } = useSandpack();
  const previewNonce = useStore((s) => s.previewNonce);
  const running = useStore((s) => s.running);
  useEffect(() => {
    if (previewNonce === 0) return;
    // Recompile ONCE, a beat after the run settled so the final files have propagated store → Sandpack.
    // (An earlier SECOND pass at 1.5s was resetting an already-rendered preview back to a white screen —
    // that's what forced a manual reload.)
    const t = setTimeout(() => { try { sandpack.runSandpack(); } catch {} }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewNonce, running]);
  return null;
}

// Always-mounted (even off the Preview tab) so it reliably catches the dev-server "done" event — a
// listener attached only when the Preview tab opens can miss a "done" that already fired.
export function PreviewReadyWatcher({ onChange }: { onChange: (ready: boolean) => void }) {
  const { listen } = useSandpack();
  useEffect(() => {
    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    const unsub = listen((msg: { type?: string }) => {
      if (msg.type === "start") {
        clearTimeout(graceTimer);
        onChange(false);
      } else if (msg.type === "done" || msg.type === "success" || msg.type === "urlchange") {
        // The bundler says "done" a beat BEFORE the app actually paints inside the iframe — hiding the
        // overlay immediately shows a brief WHITE flash. A short grace delay bridges that gap.
        clearTimeout(graceTimer);
        graceTimer = setTimeout(() => onChange(true), 550);
      }
    });
    const failsafe = setTimeout(() => onChange(true), 12000);
    return () => { unsub(); clearTimeout(graceTimer); clearTimeout(failsafe); };
  }, [listen, onChange]);
  return null;
}

export function PreviewPane({ ready }: { ready: boolean }) {
  const { inspectMode, setInspectMode, setSelection } = useStore();
  const { dispatch } = useSandpack();
  const ref = useRef<SandpackPreviewRef>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const mobile = device === "mobile";

  useEffect(() => {
    const send = () => {
      const iframe = ref.current?.getClient()?.iframe;
      iframe?.contentWindow?.postMessage({ source: "hivey-cmd", mode: inspectMode }, "*");
    };
    send();
    const t = setTimeout(send, 400);
    return () => clearTimeout(t);
  }, [inspectMode]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.source !== "hivey-inspector") return;
      if (d.type === "cancel") return setInspectMode("off");
      if (d.type === "pick" && d.payload) {
        const p = d.payload;
        setSelection({
          kind: "element",
          label: `<${p.tag}>${p.id ? "#" + p.id : ""}`,
          detail:
            `Selected element: <${p.tag}>` +
            (p.id ? ` id="${p.id}"` : "") +
            (p.classes ? ` class="${p.classes}"` : "") +
            `\nCSS selector: ${p.selector}` +
            (p.text ? `\nText: "${p.text}"` : "") +
            `\nSize: ${p.rect.w}x${p.rect.h}px`,
        });
        setInspectMode("off");
      }
      if (d.type === "zone" && d.payload) {
        const els = (d.payload.elements || []).filter(Boolean);
        setSelection({
          kind: "zone",
          label: `zone · ${els.length} element${els.length > 1 ? "s" : ""}`,
          detail:
            `Selected a zone (${d.payload.rect.w}x${d.payload.rect.h}px) containing:\n` +
            els.map((p: { tag: string; selector: string; text: string }) => `- <${p.tag}> ${p.selector}${p.text ? ` — "${p.text}"` : ""}`).join("\n"),
        });
        setInspectMode("off");
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [setInspectMode, setSelection]);

  return (
    <div className="relative h-full">
      {/* Device switch: desktop ↔ mobile. Only the wrappers' styling changes — the SandpackPreview
          stays mounted (same element + ref), so the running sandbox is never rebooted. */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
        {/* In MOBILE the phone frame hides Sandpack's navigator, so its refresh would float INSIDE
            the frame — we disable it (showRefreshButton={false}) and put our own refresh OUT here.
            In desktop the navigator keeps its own refresh, so we don't duplicate it. */}
        {mobile && (
          <button onClick={() => dispatch({ type: "refresh" })} title="Reload preview"
            className="rounded-lg border border-white/10 bg-[#1a1a22]/90 p-1.5 text-white/50 shadow-lg backdrop-blur transition-colors hover:text-white"><RotateCw size={15} /></button>
        )}
        <div className="flex rounded-lg border border-white/10 bg-[#1a1a22]/90 p-0.5 shadow-lg backdrop-blur">
          <button onClick={() => setDevice("desktop")} title="Desktop view" aria-pressed={!mobile}
            className={`rounded-md p-1.5 transition-colors ${!mobile ? "bg-accent text-white" : "text-white/50 hover:text-white"}`}><Monitor size={15} /></button>
          <button onClick={() => setDevice("mobile")} title="Mobile view" aria-pressed={mobile}
            className={`rounded-md p-1.5 transition-colors ${mobile ? "bg-accent text-white" : "text-white/50 hover:text-white"}`}><Smartphone size={15} /></button>
        </div>
      </div>
      <div className={mobile ? "flex h-full items-center justify-center overflow-auto bg-[#0b0b0f] p-4" : "h-full"}>
        <div className={mobile ? "h-full max-h-[820px] w-[390px] max-w-full shrink-0 overflow-hidden rounded-[26px] border-[7px] border-[#26262e] bg-black shadow-2xl" : "h-full w-full"}>
          <SandpackPreview ref={ref} showNavigator={!mobile} showRefreshButton={false} showOpenInCodeSandbox={false} style={{ height: "100%" }} />
        </div>
      </div>
      {!ready && (
        // The Sandpack preview is always dark (theme="dark"), so this overlay is FIXED dark too —
        // otherwise, in a light app theme, its text rendered dark ("black") over the dark preview.
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#0f0f14]">
          <div className="pointer-events-none absolute left-1/2 top-1/3 h-56 w-72 -translate-x-1/2 rounded-full bg-accent/15 blur-[100px]" />
          <div className="relative h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-accent" />
          <div className="relative flex items-center gap-1.5 text-sm text-white/60">
            <span className="font-medium text-white/90">Booting preview</span>
            <span className="inline-flex gap-0.5">
              <span className="h-1 w-1 animate-bounce rounded-full bg-accent [animation-delay:-0.2s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-accent [animation-delay:-0.1s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-accent" />
            </span>
          </div>
          <div className="relative text-[11px] text-white/45">Installing dependencies &amp; starting the dev server…</div>
        </div>
      )}
    </div>
  );
}
