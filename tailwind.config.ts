import type { Config } from "tailwindcss";

/**
 * 🐝 Hivey Code theme — kept in lockstep with the Hivey AI sidebar extension so the two products
 * feel like one. Tokens mirror src/sidebar/sidebar.css of the extension (accent #8b5cf6 → #6366f1,
 * dark surface #0f111a, etc.). Change a colour here AND in the sidebar to keep them unified.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        tool: "var(--tool)",
        elevated: "var(--elevated)",
        border: "var(--border)",
        "border-soft": "var(--border-soft)",
        accent: "var(--accent)",
        "accent-2": "var(--accent-2)",
        text: "var(--text)",
        muted: "var(--muted)",
        "on-accent": "var(--on-accent)",
        error: "var(--error)",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "var(--radius-sm)",
      },
      fontFamily: {
        sans: ["var(--ui-font)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Cascadia Code", "monospace"],
      },
      backgroundImage: {
        "hivey-grad": "var(--grad)",
        "hivey-grad-soft": "var(--grad-soft)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(139,92,246,0.25), 0 8px 30px rgba(99,102,241,0.18)",
      },
    },
  },
  plugins: [],
};
export default config;
