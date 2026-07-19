"use client";

// A draggable divider. `dir="x"` resizes horizontally (col-resize), `dir="y"` vertically.
// Calls onDelta(pixels moved) during the drag.
export function Splitter({ dir, onDelta, reverse = false }: { dir: "x" | "y"; onDelta: (d: number) => void; reverse?: boolean }) {
  const start = (e: React.MouseEvent) => {
    e.preventDefault();
    let last = dir === "x" ? e.clientX : e.clientY;
    const move = (ev: MouseEvent) => {
      const cur = dir === "x" ? ev.clientX : ev.clientY;
      onDelta(cur - last);
      last = cur;
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    document.body.style.cursor = dir === "x" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  };

  // A wide, transparent grab area (easy to catch) with a THIN gradient hairline centred inside —
  // discreet at rest (1px, tri-colour brand gradient), brighter & slightly thicker on hover.
  return (
    <div
      onMouseDown={start}
      className={"group relative shrink-0 " + (dir === "x" ? "w-2 cursor-col-resize" : "h-2 cursor-row-resize")}
    >
      <div
        className={
          "pointer-events-none absolute opacity-70 transition-all group-hover:opacity-100 " +
          (dir === "x"
            ? "inset-y-0 left-1/2 w-px -translate-x-1/2 group-hover:w-[3px]"
            : "inset-x-0 top-1/2 h-px -translate-y-1/2 group-hover:h-[3px]")
        }
        // Tri-colour brand gradient hairline — inline (not via a Tailwind class) so it ALWAYS renders
        // the gradient regardless of purge/var timing. `reverse` flips it (violet → blue) for contrast.
        style={{
          background: reverse
            ? "linear-gradient(135deg, var(--accent-2) 0%, var(--accent-2) 40%, var(--accent) 100%)"
            : "linear-gradient(135deg, var(--accent) 0%, var(--accent) 40%, var(--accent-2) 100%)",
        }}
      />
    </div>
  );
}
