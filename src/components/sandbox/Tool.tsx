"use client";

import React from "react";

export function Tool({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={`grid h-7 w-7 place-items-center rounded-sm transition-colors ${
        active ? "bg-hivey-grad text-on-accent" : "text-muted hover:text-text hover:bg-panel"
      }`}
    >
      {icon}
    </button>
  );
}
