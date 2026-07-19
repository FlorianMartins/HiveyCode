import type { FileMap } from "@/agent/types";

// Turn the in-browser project (whose toolchain is provided by Sandpack, NOT stored in the files) into
// a SELF-CONTAINED, runnable Vite + React + TS project so that `npm install && npm run dev` actually
// works on the user's machine and serves on http://localhost:5173. Without this the exported zip has
// no vite.config / clean package.json and the dev server fails — which is why "Run locally" felt broken.
export function prepareLocalProject(files: FileMap): { files: FileMap; port: number; runnable: boolean } {
  const norm: FileMap = {};
  for (const [k, v] of Object.entries(files)) norm[k.replace(/^\.?\//, "")] = v ?? "";
  const has = (p: string) => norm[p] !== undefined;

  // Detect a React/Vite web project (the previewable stacks). Other stacks (python/go/domain…) already
  // carry their own package.json from the coder, so we pass them through untouched.
  const isReactWeb = has("App.tsx") || has("index.tsx") || Object.keys(norm).some((k) => /\.(tsx|jsx)$/.test(k));
  if (!isReactWeb) return { files: norm, port: 5173, runnable: false };

  // Preserve any extra runtime deps the project added (e.g. a charting lib), drop the toolchain ones
  // (we pin a known-good set below).
  let extraDeps: Record<string, string> = {};
  try {
    const pkg = JSON.parse(norm["package.json"] || "{}");
    extraDeps = { ...(pkg.dependencies || {}) };
  } catch {}
  for (const k of ["react", "react-dom", "vite", "typescript", "esbuild-wasm"]) delete extraDeps[k];

  const entry = has("index.tsx") ? "index.tsx" : "index.tsx";

  norm["package.json"] = JSON.stringify(
    {
      name: "hivey-project",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: { dev: "vite --port 5173", build: "vite build", preview: "vite preview --port 5173" },
      dependencies: { react: "^18.3.1", "react-dom": "^18.3.1", ...extraDeps },
      devDependencies: {
        "@vitejs/plugin-react": "^4.3.1",
        vite: "^5.4.8",
        typescript: "^5.5.4",
        "@types/react": "^18.3.11",
        "@types/react-dom": "^18.3.0",
      },
    },
    null,
    2,
  );

  norm["vite.config.ts"] =
    `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\n// Serves the app on http://localhost:5173 with React Fast Refresh.\nexport default defineConfig({\n  plugins: [react()],\n  server: { port: 5173, open: true },\n});\n`;

  // A correct entry that renders <App/> — only created if the project doesn't already ship one.
  if (!has(entry)) {
    norm[entry] = `import { createRoot } from "react-dom/client";\nimport App from "./App";\nimport "./styles.css";\n\ncreateRoot(document.getElementById("root")!).render(<App />);\n`;
  }
  if (!has("styles.css")) norm["styles.css"] = "";

  // index.html with the Tailwind Play CDN (same as the in-app preview, so utility classes render) and
  // the module entry.
  norm["index.html"] =
    `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Hivey app</title>\n    <script src="https://cdn.tailwindcss.com"></script>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/${entry}"></script>\n  </body>\n</html>\n`;

  if (!has("tsconfig.json")) {
    norm["tsconfig.json"] = JSON.stringify(
      {
        compilerOptions: {
          target: "ESNext",
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          allowImportingTsExtensions: false,
          lib: ["DOM", "DOM.Iterable", "ESNext"],
        },
        include: ["**/*.ts", "**/*.tsx"],
      },
      null,
      2,
    );
  }

  norm["README.md"] = `# Hivey project\n\nRun it locally:\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nThen open http://localhost:5173\n`;
  norm[".gitignore"] = `node_modules\ndist\n.DS_Store\n`;

  return { files: norm, port: 5173, runnable: true };
}
