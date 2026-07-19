import type { FileMap } from "./types";

// 🐝 Starter scaffold — a ready-to-run Vite + React + TS project the agents build INTO, instead of
// regenerating boilerplate from scratch every time. This makes builds much faster and cheaper (the
// model only writes App.tsx + the components/styles it needs) and it means the preview lights up
// instantly. Paths are ROOT-relative to match the Sandpack "vite-react-ts" runtime, whose entry
// (index.tsx) renders <App/> from "./App" and imports "./styles.css".
//
// Common UI deps are pre-installed so the model can import them without editing package.json.
export const STARTER: FileMap = {
  // Aligned with Sandpack's tested vite-react-ts defaults (vite 4.2.0 + esbuild-wasm) so the preview
  // runs reliably in the browser sandbox — only extra UI deps are added on top.
  "package.json": JSON.stringify(
    {
      scripts: { dev: "vite", build: "tsc && vite build", preview: "vite preview" },
      dependencies: {
        react: "^19.0.0",
        "react-dom": "^19.0.0",
        "lucide-react": "^0.460.0",
        "framer-motion": "^11.11.0",
        clsx: "^2.1.1",
      },
      devDependencies: {
        "@types/react": "^19.0.8",
        "@types/react-dom": "^19.0.3",
        "@vitejs/plugin-react": "^4.3.4",
        typescript: "^4.9.5",
        vite: "4.2.0",
        "esbuild-wasm": "^0.17.12",
      },
    },
    null,
    2,
  ),
  "tsconfig.json": JSON.stringify(
    {
      compilerOptions: {
        target: "ESNext",
        useDefineForClassFields: true,
        lib: ["DOM", "DOM.Iterable", "ESNext"],
        allowJs: false,
        skipLibCheck: true,
        esModuleInterop: false,
        allowSyntheticDefaultImports: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        module: "ESNext",
        moduleResolution: "Node",
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",
      },
      include: ["."],
    },
    null,
    2,
  ),
  // Root index.html in VITE convention (so the server-side `vite build` for Deploy/Export works). The
  // in-browser PREVIEW uses Sandpack's LEGACY bundler (create-react-app env) instead of the nodebox
  // runtime — nodebox's service-worker + BroadcastChannel bridge fails in Firefox ("no response from the
  // BroadcastChannel"). Sandbox.tsx adapts this file for the CRA bundler on the fly (relocates it to
  // public/index.html and drops the module script). Tailwind = Play CDN (JIT in the browser).
  "index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Hivey App</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = { theme: { extend: { fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] } } } };
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/index.tsx"></script>
  </body>
</html>
`,
  "index.tsx": `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// Tailwind Play CDN loader (bundler-agnostic): some in-browser preview bundlers do NOT execute the
// <script> tags in index.html, which left the app completely unstyled. Loading it here — from the
// bundled JS entry, which always runs — guarantees Tailwind utility classes are applied. Skipped if a
// Tailwind script is already present (real index.html), and harmless in a real vite build.
if (typeof document !== "undefined" && !document.querySelector('script[src*="tailwindcss.com"]')) {
  const twcdn = document.createElement("script");
  twcdn.src = "https://cdn.tailwindcss.com";
  document.head.appendChild(twcdn);
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
  "styles.css": `:root {
  color-scheme: light dark;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
`,
  "App.tsx": `export default function App() {
  return (
    <div style={{ minHeight: "100%", display: "grid", placeItems: "center", background: "#0f0f14", color: "#e7e7ee" }}>
      <div style={{ textAlign: "center", opacity: 0.8 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Setting up your project…</div>
        <div style={{ fontSize: 13, marginTop: 6, color: "#9aa" }}>The Hivey agents are writing the code.</div>
      </div>
    </div>
  );
}
`,
};
