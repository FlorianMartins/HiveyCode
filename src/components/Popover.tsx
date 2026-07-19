"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Glass popover rendered in a PORTAL with fixed positioning, so it floats ABOVE everything
// (menu bar, panels) and is never clipped by an overflow:hidden ancestor.
export function Popover({
  trigger,
  children,
  align = "left",
  direction = "down",
  width = 240,
}: {
  trigger: (open: boolean) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  direction?: "down" | "up";
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number }>({ left: 0 });

  useEffect(() => setMounted(true), []);

  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    let left = align === "right" ? r.right - width : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    if (direction === "up") setPos({ left, bottom: window.innerHeight - r.top + 6 });
    else setPos({ left, top: r.bottom + 6 });
  };

  useLayoutEffect(() => {
    if (open) place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const reposition = () => place();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen((o) => !o)}>
        {trigger(open)}
      </button>
      {open &&
        mounted &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width }}
            className="pop-in z-[200] max-h-[62vh] overflow-auto rounded-xl border border-border bg-panel/70 p-1 shadow-glow backdrop-blur-2xl"
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </>
  );
}
