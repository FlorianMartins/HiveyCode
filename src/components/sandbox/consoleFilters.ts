// Noise filtering for the project console.
//
// The Sandpack bundler and the dev server both talk a great deal, and almost none of it is about
// the user's app. These patterns separate "your code broke" from infrastructure chatter, which is
// the difference between a console someone reads and one they learn to ignore.

export type ConsoleLevel = "cmd" | "err" | "error";
export interface ConsoleLine {
  id: number;
  level: ConsoleLevel;
  text: string;
}

// Dev-server / bundler / container noise to drop from stdout "out".
// PURE noise = harmless nodebox/xterm chatter that is NEVER useful — dropped from EVERY stream,
// including stderr (that's why "clearScreenDown is not yet implemented…" kept showing: it arrives on
// stderr, which bypasses the infra filter below).
export const PURE_NOISE = /is not yet implemented\. Please file an issue on GitHub|Please file an issue on GitHub if you rely on this feature|^\s*$/i;
// INFRA chatter = dev-server/build progress. Dropped only for NON-error output — never used to filter
// real errors (an app error that happens to mention "vite"/"reload"/"compiled" must still show).
export const SERVER_NOISE =
  /vite\s+v?\d|ready in|\bLocal:|\bNetwork:|press h to|\bhmr\b|\[hmr\]|hot update|hmr update|\[vite\]|nodebox|webcontainer|watching for (file|change)|server (re)?start|optimiz(ing|ed) dependencies|re-optimizing|forced re-optimization|page reload|reloading|➜|dev server|listening on|Port \d|dependencies installed|added \d+ packages|found 0 vulnerabilities|npm warn|deprecated|compil(ing|ed)|transform(ing|ed)?|modules transformed|built in |gzip:|bundling|esbuild|rollup|wss?:\/\/|websocket|sockjs|waiting for|no issues found/i;

export const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;?=]*[A-Za-z]/g, "").replace(/\u001b[=>NOc]/g, "");
export const safeStr = (d: unknown) => {
  try {
    return typeof d === "string" ? d : JSON.stringify(d);
  } catch {
    return String(d);
  }
};
