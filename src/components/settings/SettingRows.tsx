"use client";

// The two repeated row shapes of the settings drawer: a colour swatch + hex field, and a
// labelled slider. Extracted so the drawer itself stays a composition rather than a catalogue.

export function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-muted">{label}</span>
      <label className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-border" style={{ background: value }} title="Pick colour">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-0 w-0 opacity-0" />
      </label>
      <span className="font-mono text-[11px] text-muted">{value}</span>
    </div>
  );
}

export function SliderRow({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-muted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-tool accent-[var(--accent)]"
      />
      <span className="w-12 shrink-0 text-right font-mono text-[11px] text-muted">{fmt(value)}</span>
    </div>
  );
}
