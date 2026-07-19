// The Hivey mark — a beehive (skep) of 4 rounded bars, identical to the sidebar extension's logo.
export function HiveLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} className={className} role="img" aria-label="Hivey">
      <defs>
        <linearGradient id="hive-grad" x1="8" y1="8" x2="88" y2="88" gradientUnits="userSpaceOnUse">
          {/* Tied to the theme accents (blue → violet), synced with the sidebar. */}
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="0.55" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>
      <g fill="url(#hive-grad)">
        <rect x="17" y="9" width="62" height="14" rx="7" />
        <rect x="8" y="30" width="80" height="14" rx="7" />
        <rect x="12" y="51" width="72" height="14" rx="7" />
        <rect x="23" y="72" width="50" height="14" rx="7" />
      </g>
    </svg>
  );
}
