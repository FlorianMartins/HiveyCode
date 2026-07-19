import type { FileMap } from "./types";
import { STARTER } from "./scaffold";

// 🐝 Project templates. Two levels, exactly as the product intends:
//   • WEB frameworks  → live preview in the browser via Sandpack (React/Vue/Svelte/Solid/vanilla…).
//   • CODE stacks     → the agents scaffold & edit the files (editor + export), but there's NO live
//                        browser preview (Flutter/C/C++/Rust/Go/Python need a native/WASM toolchain).
export type TemplateCategory = "custom" | "web" | "code" | "domain";

export interface TemplateDef {
  id: string;
  label: string;
  lang: string; // Monaco language hint / description
  category: TemplateCategory;
  sandpack: string; // Sandpack template id (a harmless "static" is used for code stacks)
  preview: boolean; // live browser preview available?
  scaffold: FileMap; // starter files (may be {} → the coder builds the whole thing; Sandpack fills defaults)
  guide: string; // framework-specific instructions handed to the coder
  icon: string; // lucide-react icon name
}

// "custom" is its OWN category — a blank project, neither a web framework preset nor a code stack.
const custom = (o: Omit<TemplateDef, "category" | "preview">): TemplateDef => ({ ...o, category: "custom", preview: true });
const web = (o: Omit<TemplateDef, "category" | "preview">): TemplateDef => ({ ...o, category: "web", preview: true });
const code = (o: Omit<TemplateDef, "category" | "preview" | "sandpack">): TemplateDef => ({ ...o, category: "code", preview: false, sandpack: "static" });
// "domain" = a specialized PROJECT TYPE (Discord bot, browser add-on, IBM i RPGLE…). The point is to
// focus the AI agents on that domain's exact stack, conventions and file layout for maximum precision.
// No live browser preview (the agents scaffold + edit + export); the guide carries the domain rules.
const domain = (o: Omit<TemplateDef, "category" | "preview" | "sandpack">): TemplateDef => ({ ...o, category: "domain", preview: false, sandpack: "static" });

export const TEMPLATES: TemplateDef[] = [
  web({
    id: "react",
    label: "React",
    lang: "React + TS",
    sandpack: "react-ts",
    scaffold: STARTER,
    icon: "Atom",
    guide:
      "React + TypeScript. CRITICAL: the fixed entry `index.tsx` renders <App/> from \"./App\" — so you " +
      "MUST output `App.tsx` at the project ROOT with a DEFAULT export; that file IS what the preview " +
      "shows. Do NOT put it in src/ (src/App.tsx will NOT render). Put components in `components/…` at " +
      "the root and global CSS in `styles.css`. Do NOT touch the shell files `index.tsx` and " +
      "`index.html` — they already exist and wire up the app. Tailwind CSS is available (Play CDN " +
      "in index.html) — style with Tailwind utility classes freely; they render live in the " +
      "preview. If you want a Google-Font / icon, add a `<link>` to index.html's <head> WITHOUT " +
      "removing the Tailwind `<script src=\"https://cdn.tailwindcss.com\">` or the `<div id=\"root\">`; " +
      "extend the theme via the INLINE `tailwind.config = {…}` already there (do NOT add a " +
      "tailwind.config.js / PostCSS setup — it won't apply). Prefer defining design tokens (colours, " +
      "fonts, radii) as CSS custom properties in styles.css. lucide-react, framer-motion and clsx are " +
      "pre-installed; for another npm package, also output package.json with it added (keep react, " +
      "react-dom).",
  }),
  custom({
    id: "custom",
    label: "Custom (blank)",
    lang: "Blank project — no preset",
    sandpack: "react-ts",
    scaffold: STARTER,
    icon: "SquareDashed",
    guide:
      "A BLANK project — NO product template, preset or opinionated structure is applied. Build EXACTLY and ONLY " +
      "what the user asks, choosing your own architecture. Same React + TS runtime as the React pack: output " +
      "`App.tsx` at the ROOT with a default export, components in `components/…`, global CSS in `styles.css`. " +
      "Do NOT touch the shell files `index.tsx` / `index.html`. Tailwind is available (Play CDN in " +
      "index.html). lucide-react, framer-motion and clsx are pre-installed.",
  }),
  web({
    id: "preact",
    label: "Preact",
    lang: "Preact + Vite + TS",
    sandpack: "vite-preact-ts",
    scaffold: {},
    icon: "Atom",
    guide:
      "Vite + Preact + TypeScript. Entry src/main.tsx renders <App/> from './app'. Output index.html, src/main.tsx, " +
      "src/app.tsx (Preact components) and styles. Keep package.json with preact.",
  }),
  web({
    id: "nextjs",
    label: "Next.js",
    lang: "Next.js + React + TS",
    sandpack: "nextjs",
    scaffold: {},
    icon: "Triangle",
    guide:
      "Next.js (pages router) + React + TypeScript. Output pages/index.tsx (default-exported page component), any " +
      "components/*.tsx, pages/_app.tsx if needed, and CSS modules or styles/globals.css. Keep package.json with next/react.",
  }),
  web({
    id: "vue",
    label: "Vue",
    lang: "Vue 3 + Vite + TS",
    sandpack: "vite-vue-ts",
    scaffold: {},
    icon: "Component",
    guide:
      "Vite + Vue 3 + TypeScript. Entry src/main.ts creates the app from src/App.vue and mounts #app " +
      "(index.html has <div id=\"app\">). Use <script setup lang=\"ts\"> single-file components. Output " +
      "index.html, src/main.ts, src/App.vue, any src/components/*.vue, and styles. Keep package.json with vue.",
  }),
  web({
    id: "svelte",
    label: "Svelte",
    lang: "Svelte + Vite + TS",
    sandpack: "vite-svelte-ts",
    scaffold: {},
    icon: "Flame",
    guide:
      "Vite + Svelte + TypeScript. Entry src/main.ts renders src/App.svelte into #app. Output index.html, " +
      "src/main.ts, src/App.svelte, src/components/*.svelte and styles. Keep package.json with svelte.",
  }),
  web({
    id: "solid",
    label: "Solid",
    lang: "SolidJS + TS",
    sandpack: "solid",
    scaffold: {},
    icon: "Zap",
    guide:
      'SolidJS + TypeScript. The entry (index.tsx) renders <App/> from "./App". Output index.tsx, App.tsx ' +
      "(solid-js components using signals), components and styles. Keep package.json with solid-js.",
  }),
  web({
    id: "vanilla",
    label: "Vanilla JS",
    lang: "TypeScript + HTML + CSS",
    sandpack: "vanilla-ts",
    icon: "Braces",
    scaffold: {
      "index.html": `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Hivey App</title></head>
  <body>
    <div id="app"></div>
    <script type="module" src="/index.ts"></script>
  </body>
</html>
`,
      "index.ts": `import "./styles.css";
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = "<h1>Hello from Hivey Code</h1>";
`,
      "styles.css": `body { font-family: system-ui, sans-serif; margin: 0; }
`,
    },
    guide:
      "Pure TypeScript + HTML + CSS (no framework). Entry index.html loads /index.ts which imports " +
      "./styles.css and drives the DOM under #app. Output index.html, index.ts, styles.css and any extra modules.",
  }),
  web({
    id: "static",
    label: "Static HTML",
    lang: "HTML + CSS + JS",
    sandpack: "static",
    icon: "FileCode",
    scaffold: {
      "index.html": `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Hivey App</title><link rel="stylesheet" href="style.css" /></head>
  <body>
    <h1>Hello from Hivey Code</h1>
    <script src="script.js"></script>
  </body>
</html>
`,
      "style.css": `body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; }
`,
      "script.js": `console.log("Hivey Code");
`,
    },
    guide:
      "Plain static site — HTML + CSS + vanilla JS, no build step. index.html links style.css and script.js. " +
      "Output index.html and any css/js/asset files. Use relative paths.",
  }),
  // ── CODE stacks: scaffold + editor + export, NO live browser preview ────────────────────────────
  code({
    id: "python",
    label: "Python",
    lang: "Python",
    icon: "FileTerminal",
    scaffold: { "main.py": `def main() -> None:\n    print("Hello from Hivey Code")\n\n\nif __name__ == "__main__":\n    main()\n` },
    guide: "A complete Python project (entry main.py). No live browser preview — the user edits/exports the code. Output all needed .py files, plus requirements.txt if you use packages.",
  }),
  code({
    id: "c",
    label: "C",
    lang: "C",
    icon: "FileCode2",
    scaffold: {
      "Makefile": `CC = gcc
CFLAGS = -Wall -Wextra -std=c11 -Iinclude -O2
SRC = $(wildcard src/*.c)
OBJ = $(SRC:.c=.o)
BIN = app

all: $(BIN)

$(BIN): $(OBJ)
\t$(CC) $(CFLAGS) -o $@ $^

%.o: %.c
\t$(CC) $(CFLAGS) -c $< -o $@

run: $(BIN)
\t./$(BIN)

clean:
\trm -f $(OBJ) $(BIN)

.PHONY: all run clean
`,
      "include/util.h": `#ifndef UTIL_H
#define UTIL_H

/* Public API for the util module — declare shared functions here. */
void greet(const char *name);

#endif /* UTIL_H */
`,
      "src/util.c": `#include <stdio.h>
#include "util.h"

void greet(const char *name) {
    printf("Hello, %s!\\n", name);
}
`,
      "src/main.c": `#include "util.h"

int main(void) {
    greet("Hivey Code");
    return 0;
}
`,
      "README.md": `# C project

Modular C11 layout: sources in \`src/\`, public headers in \`include/\`.

## Build & run
\`\`\`sh
make run     # build then run ./app
make clean   # remove objects + binary
\`\`\`
`,
    },
    guide:
      "A complete, MODULAR C project. Structure: sources in `src/` (entry `src/main.c`), public headers in `include/`, built by the `Makefile` (compiles every src/*.c). BUILD INTO this structure — add new modules as `src/<name>.c` + `include/<name>.h` and they compile automatically. Keep the entry at `src/main.c`. No live browser preview (edit + export).",
  }),
  code({
    id: "cpp",
    label: "C++",
    lang: "C++",
    icon: "FileCode2",
    scaffold: {
      "CMakeLists.txt": `cmake_minimum_required(VERSION 3.16)
project(hivey_app CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(include)
file(GLOB SOURCES src/*.cpp)
add_executable(app \${SOURCES})
`,
      "include/app.hpp": `#pragma once
#include <string>

// Example domain class — extend or replace to model your program.
class App {
public:
    explicit App(std::string name);
    void run() const;

private:
    std::string name_;
};
`,
      "src/app.cpp": `#include "app.hpp"
#include <iostream>

App::App(std::string name) : name_(std::move(name)) {}

void App::run() const {
    std::cout << "Hello, " << name_ << "!\\n";
}
`,
      "src/main.cpp": `#include "app.hpp"

int main() {
    App app("Hivey Code");
    app.run();
    return 0;
}
`,
      "README.md": `# C++ project

Modern C++17 layout: implementation in \`src/\`, headers in \`include/\`, built with CMake.

## Build & run
\`\`\`sh
cmake -B build && cmake --build build
./build/app
\`\`\`
`,
    },
    guide:
      "A complete, MODERN C++17 project. Structure: implementation in `src/` (entry `src/main.cpp`), headers in `include/`, built by `CMakeLists.txt` (globs every src/*.cpp). BUILD INTO this structure — add classes as `include/<Name>.hpp` + `src/<Name>.cpp`; they compile automatically. Keep the entry at `src/main.cpp`. Prefer RAII, `std::` containers, smart pointers. No live browser preview (edit + export).",
  }),
  code({
    id: "rust",
    label: "Rust",
    lang: "Rust",
    icon: "Cog",
    scaffold: {
      "Cargo.toml": `[package]\nname = "hivey-app"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n`,
      "src/main.rs": `fn main() {\n    println!("Hello from Hivey Code");\n}\n`,
    },
    guide: "A complete Rust project (Cargo.toml + src/main.rs). No live browser preview. Output the crate files and add dependencies to Cargo.toml as needed.",
  }),
  code({
    id: "go",
    label: "Go",
    lang: "Go",
    icon: "Cog",
    scaffold: {
      "go.mod": `module hivey-app\n\ngo 1.22\n`,
      "main.go": `package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello from Hivey Code")\n}\n`,
    },
    guide: "A complete Go project (go.mod + main.go). No live browser preview. Output all .go files and update go.mod for dependencies.",
  }),
  code({
    id: "flutter",
    label: "Flutter",
    lang: "Dart / Flutter",
    icon: "Smartphone",
    scaffold: {
      "pubspec.yaml": `name: hivey_app\ndescription: A Hivey Code Flutter app.\npublish_to: 'none'\nversion: 1.0.0+1\n\nenvironment:\n  sdk: '>=3.0.0 <4.0.0'\n\ndependencies:\n  flutter:\n    sdk: flutter\n\nflutter:\n  uses-material-design: true\n`,
      "lib/main.dart": `import 'package:flutter/material.dart';\n\nvoid main() => runApp(const MyApp());\n\nclass MyApp extends StatelessWidget {\n  const MyApp({super.key});\n  @override\n  Widget build(BuildContext context) {\n    return MaterialApp(\n      home: Scaffold(\n        appBar: AppBar(title: const Text('Hivey Code')),\n        body: const Center(child: Text('Hello from Hivey Code')),\n      ),\n    );\n  }\n}\n`,
    },
    guide: "A complete Flutter app (pubspec.yaml + lib/main.dart). No live browser preview — export the project and run it with the Flutter SDK / Expo-Go-style on a device. Output all lib/*.dart files and update pubspec.yaml dependencies.",
  }),
  code({
    id: "typescript",
    label: "TypeScript",
    lang: "TypeScript (Node)",
    icon: "FileType",
    scaffold: { "index.ts": `function main(): void {\n  console.log("Hello from Hivey Code");\n}\n\nmain();\n`, "package.json": `{\n  "name": "hivey-app",\n  "type": "module",\n  "scripts": { "start": "tsx index.ts" }\n}\n` },
    guide: "A complete TypeScript (Node) project. Entry index.ts. No live browser preview. Output all .ts files + package.json (add deps as needed).",
  }),
  code({
    id: "javascript",
    label: "JavaScript",
    lang: "JavaScript (Node)",
    icon: "Braces",
    scaffold: { "index.js": `function main() {\n  console.log("Hello from Hivey Code");\n}\n\nmain();\n`, "package.json": `{\n  "name": "hivey-app",\n  "type": "module",\n  "scripts": { "start": "node index.js" }\n}\n` },
    guide: "A complete Node.js JavaScript project. Entry index.js. No live browser preview. Output all .js files + package.json.",
  }),
  code({
    id: "java",
    label: "Java",
    lang: "Java",
    icon: "Coffee",
    scaffold: {
      "src/com/hivey/Main.java": `package com.hivey;

public class Main {
    public static void main(String[] args) {
        Greeter greeter = new Greeter("Hivey Code");
        System.out.println(greeter.greeting());
    }
}
`,
      "src/com/hivey/Greeter.java": `package com.hivey;

/** Example domain class — extend or replace to model your program. */
public class Greeter {
    private final String name;

    public Greeter(String name) {
        this.name = name;
    }

    public String greeting() {
        return "Hello, " + name + "!";
    }
}
`,
      "README.md": `# Java project

Package layout under \`src/com/hivey\` (entry \`Main\`).

## Build & run
\`\`\`sh
javac -d out src/com/hivey/*.java
java -cp out com.hivey.Main
\`\`\`
`,
    },
    guide:
      "A complete Java project with a PACKAGE structure: classes live under `src/com/hivey/` in package `com.hivey` (entry `Main`). BUILD INTO this structure — add each new class as `src/com/hivey/<Name>.java` in the same package (or subpackages `src/com/hivey/<sub>/`). Keep `Main` as the entry point. One public class per file, matching the filename. No live browser preview (edit + export).",
  }),
  code({
    id: "kotlin",
    label: "Kotlin",
    lang: "Kotlin",
    icon: "Cog",
    scaffold: { "Main.kt": `fun main() {\n    println("Hello from Hivey Code")\n}\n` },
    guide: "A complete Kotlin project (entry Main.kt). No live browser preview. Output all .kt files.",
  }),
  code({
    id: "csharp",
    label: "C#",
    lang: "C#",
    icon: "Hash",
    scaffold: { "Program.cs": `using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello from Hivey Code");\n    }\n}\n` },
    guide: "A complete C# project (entry Program.cs). No live browser preview. Output .cs files and a .csproj if useful.",
  }),
  code({
    id: "php",
    label: "PHP",
    lang: "PHP",
    icon: "FileCode2",
    scaffold: { "index.php": `<?php\n\necho "Hello from Hivey Code\\n";\n` },
    guide: "A complete PHP project (entry index.php). No live browser preview. Output all .php files.",
  }),
  code({
    id: "ruby",
    label: "Ruby",
    lang: "Ruby",
    icon: "Gem",
    scaffold: { "main.rb": `def main\n  puts "Hello from Hivey Code"\nend\n\nmain\n` },
    guide: "A complete Ruby project (entry main.rb). No live browser preview. Output all .rb files + a Gemfile if you use gems.",
  }),
  code({
    id: "swift",
    label: "Swift",
    lang: "Swift",
    icon: "Bird",
    scaffold: { "main.swift": `print("Hello from Hivey Code")\n` },
    guide: "A complete Swift project (entry main.swift). No live browser preview. Output all .swift files + Package.swift if useful.",
  }),
  code({
    id: "cobol",
    label: "COBOL",
    lang: "COBOL (GnuCOBOL)",
    icon: "FileCode2",
    scaffold: {},
    guide:
      "A complete COBOL program (target GnuCOBOL/cobc, also mainframe-friendly). Use the 4 DIVISIONS " +
      "(IDENTIFICATION, ENVIRONMENT, DATA, PROCEDURE) with proper structure, PIC clauses, level numbers (01/05/…), " +
      "SELECT/ASSIGN + FD for files, paragraphs/sections with clear PERFORM flow, and clean COMP/COMP-3 usage where relevant. " +
      "Prefer free-format or fixed-format consistently (state which). `.cob`/`.cbl` files. Add a README with the exact `cobc -x -free file.cob` compile+run steps. Correctness of COBOL syntax is the priority; no preview.",
  }),
  code({
    id: "fortran",
    label: "Fortran",
    lang: "Modern Fortran (2008+)",
    icon: "FileCode",
    scaffold: {},
    guide: "A complete MODERN Fortran (2008+) project: `program`/`module`/`subroutine`/`function`, `implicit none` everywhere, typed declarations, allocatable arrays. `.f90` files + a README with `gfortran` build steps. No browser preview.",
  }),
  code({
    id: "perl",
    label: "Perl",
    lang: "Perl 5",
    icon: "FileTerminal",
    scaffold: { "main.pl": `#!/usr/bin/env perl\nuse strict;\nuse warnings;\n\nprint \"Hello from Hivey Code\\n\";\n` },
    guide: "A complete Perl 5 project. ALWAYS `use strict; use warnings;`. Idiomatic Perl, modules under lib/ (package + `1;`), a cpanfile if deps are needed. `.pl`/`.pm` files. No browser preview.",
  }),
  code({
    id: "lua",
    label: "Lua",
    lang: "Lua 5.4",
    icon: "Braces",
    scaffold: { "main.lua": `print(\"Hello from Hivey Code\")\n` },
    guide: "A complete Lua 5.4 project (entry main.lua). Idiomatic Lua (locals by default, modules returning a table). Note LÖVE/OpenResty conventions only if the user asks. No browser preview.",
  }),
  code({
    id: "assembly",
    label: "Assembly (x86-64)",
    lang: "x86-64 NASM (Linux)",
    icon: "Cog",
    scaffold: {},
    guide: "A complete x86-64 assembly project in NASM syntax for Linux (System V ABI, syscalls). `.asm` files with .data/.bss/.text sections and a clear _start or main. Add a README with `nasm -f elf64` + `ld`/`gcc` link steps. Comment the register usage. No preview.",
  }),
  code({
    id: "scala",
    label: "Scala",
    lang: "Scala 3",
    icon: "Coffee",
    scaffold: {},
    guide: "A complete Scala 3 project (sbt layout: build.sbt + src/main/scala). Idiomatic, prefer immutability and the standard library. `.scala` files. No browser preview.",
  }),
  code({
    id: "elixir",
    label: "Elixir",
    lang: "Elixir (Mix)",
    icon: "Flame",
    scaffold: {},
    guide: "A complete Elixir project with a Mix layout (mix.exs + lib/). Idiomatic Elixir (pattern matching, pipes, GenServer/supervision when relevant). `.ex`/`.exs` files. No browser preview.",
  }),
  code({
    id: "haskell",
    label: "Haskell",
    lang: "Haskell (Stack/Cabal)",
    icon: "Hash",
    scaffold: {},
    guide: "A complete Haskell project (Stack or Cabal layout: package.yaml/.cabal + app/Main.hs + src/). Idiomatic, typed, pure where possible. `.hs` files. No browser preview.",
  }),

  // ── Specialized domains — focus the agents on one stack/convention set ──────────────────────────
  domain({
    id: "discord-bot",
    label: "Discord bot",
    lang: "discord.js + TypeScript (Node)",
    icon: "Bot",
    scaffold: {},
    guide:
      "Build a COMPLETE Discord bot with discord.js v14 + TypeScript (Node 18+). CONVENTIONS: entry `src/index.ts` " +
      "creates a `Client` with the exact `GatewayIntentBits` the features need (and `Partials` for DMs/reactions when used). " +
      "Use SLASH commands: one file per command in `src/commands/<name>.ts` exporting `{ data: SlashCommandBuilder, execute }`, " +
      "loaded dynamically; put listeners in `src/events/<event>.ts`. Provide `src/deploy-commands.ts` (REST `PUT` to register commands). " +
      "Read the token/clientId/guildId from `process.env` via dotenv; ship `.env.example` (NEVER a real token) and a `.gitignore`. " +
      "Output `package.json` (deps: discord.js, dotenv; devDeps: typescript, tsx, @types/node; scripts: dev=`tsx watch src/index.ts`, " +
      "start, deploy) and `tsconfig.json`. Handle errors and rate limits. No browser preview — this runs on Node.",
  }),
  domain({
    id: "telegram-bot",
    label: "Telegram bot",
    lang: "grammY + TypeScript (Node)",
    icon: "Send",
    scaffold: {},
    guide:
      "Build a COMPLETE Telegram bot with the grammY framework + TypeScript (Node 18+). Entry `src/bot.ts` creates `new Bot(process.env.BOT_TOKEN!)`; " +
      "register command handlers (`bot.command(...)`), message/callback handlers and inline keyboards in `src/handlers/`. Use middleware/session where useful. " +
      "Read config from `process.env` via dotenv; ship `.env.example` (no real token) + `.gitignore`. Output `package.json` (grammy, dotenv; devDeps typescript, tsx, @types/node; " +
      "scripts dev/start) and `tsconfig.json`. Graceful shutdown + error handling (`bot.catch`). Node runtime, no browser preview.",
  }),
  domain({
    id: "web-extension",
    label: "Browser add-on",
    lang: "WebExtension · Manifest V3 · live dev",
    icon: "Puzzle",
    scaffold: {},
    guide:
      "Build a cross-browser (Chrome + Firefox) MANIFEST V3 web extension WITH A ONE-COMMAND LIVE-DEV SETUP so the user can run it " +
      "straight in their browser with auto-reload. REQUIREMENTS:\n" +
      "• `manifest.json` (manifest_version 3) with the MINIMUM permissions/host_permissions the feature needs — never `<all_urls>` unless truly required. " +
      "Include `browser_specific_settings.gecko.id` (an email-style id) so Firefox/web-ext accepts it.\n" +
      "• Structure: `background/service-worker.js` (event-driven), `content/content.js` (guard against double-injection), `popup/popup.html`+`popup.js`+`popup.css`, " +
      "and `options/` if there are settings (`chrome.storage.sync`/`local`). Use the `chrome.*` MV3 promise APIs. Strict CSP (no remote code, no eval).\n" +
      "• LIVE DEV via Mozilla's `web-ext`: output a `package.json` with devDependency `web-ext` and scripts " +
      "`\"dev\": \"web-ext run\"` (launches a fresh Firefox with the extension loaded and AUTO-RELOADS on file changes), " +
      "`\"dev:chrome\": \"web-ext run -t chromium\"`, and `\"build\": \"web-ext build\"`. Add a `web-ext.config.cjs` if useful (ignore node_modules, dist).\n" +
      "• `README.md` with the EXACT quick start: `npm install` then `npm run dev` = the add-on running live in the browser; " +
      "plus the manual Chrome path (chrome://extensions → Developer mode → Load unpacked → this folder). Reference 16/48/128 icons. Keep everything self-contained. " +
      "(No in-app Sandpack preview — the browser IS the preview via web-ext.)",
  }),
  domain({
    id: "cli-tool",
    label: "CLI tool",
    lang: "Node + TypeScript (commander)",
    icon: "SquareTerminal",
    scaffold: {},
    guide:
      "Build a polished command-line tool in TypeScript (Node 18+). Entry `src/cli.ts` with a `#!/usr/bin/env node` shebang; parse args with " +
      "commander (subcommands, options, `--help`, `--version`). Keep logic in `src/lib/` (testable, no process.exit inside). Nice UX: colored output " +
      "(picocolors), spinners for long tasks, clear errors with non-zero exit codes. Output `package.json` with a `bin` field, build script (tsup or tsc) " +
      "and deps; plus `tsconfig.json` and a `README.md` with usage examples. Node runtime, no browser preview.",
  }),
  domain({
    id: "ibmi-rpgle",
    label: "IBM i · RPGLE",
    lang: "RPG ILE (free-form) + DDS",
    icon: "Server",
    scaffold: {},
    guide:
      "Build an IBM i (AS/400) application in FULLY FREE-FORM RPG ILE (`**FREE` on line 1, no fixed columns). CONVENTIONS: `.rpgle` for programs, " +
      "`.sqlrpgle` when embedding SQL (use embedded SQL, not native I/O, for DB access), `.dds` for DDS source — physical files (PF), logical files (LF) and " +
      "display files (DSPF) with proper record formats, indicators and keywords. Use `ctl-opt` (dftactgrp(*no), option(*srcstmt:*nodebugio), main(...)) , " +
      "`dcl-pr`/`dcl-pi` prototypes, `dcl-s`/`dcl-ds` declarations, and modular procedures (`dcl-proc … end-proc`). Provide CL (`.clle`) for compile/run steps " +
      "(CRTBNDRPG / CRTDSPF / CRTPF) and a README documenting the objects, the library list and how to compile on the IBM i. Code must be clean, indented and " +
      "commented. There is NO preview/execution here — the agents produce correct, compile-ready source for the target IBM i. Prioritize correctness of RPGLE/DDS syntax.",
  }),
  domain({
    id: "android",
    label: "Android app (native)",
    lang: "Kotlin + Jetpack Compose",
    icon: "Smartphone",
    scaffold: {},
    guide:
      "Build a NATIVE Android app in Kotlin with Jetpack Compose (Material 3). Structure a real Gradle project: " +
      "`settings.gradle.kts`, root + `app/build.gradle.kts` (compileSdk 34, minSdk 24, Compose enabled, Kotlin), " +
      "`app/src/main/AndroidManifest.xml` with the MINIMUM permissions, and `app/src/main/java/<package>/…` — " +
      "`MainActivity.kt` (setContent), `@Composable` screens/components, a `ViewModel` (+ StateFlow) per screen, " +
      "and a repository layer. Use Compose Navigation for multi-screen, and Material 3 theming (Color/Type/Theme.kt). " +
      "Idiomatic Kotlin (coroutines/Flow, no findViewById). Add strings.xml (no hardcoded UI strings) and a README with the " +
      "exact build steps (`./gradlew assembleDebug`, run in Android Studio / emulator). No in-app preview — the emulator/device is the target.",
  }),
  domain({
    id: "ios",
    label: "iOS app (native)",
    lang: "Swift + SwiftUI",
    icon: "Smartphone",
    scaffold: {},
    guide:
      "Build a NATIVE iOS app in Swift with SwiftUI (iOS 16+). Structure: `<App>App.swift` (@main App with WindowGroup), " +
      "SwiftUI `View` structs (small, composable), an `ObservableObject`/`@Observable` view-model per screen with `@Published`/state, " +
      "and a services/repository layer (async/await). Use `NavigationStack` for navigation, `Codable` models, and follow MVVM. " +
      "Idiomatic modern Swift (value types, optionals handled, no force-unwraps). Provide an Assets note and a README explaining how to " +
      "create the Xcode project (or an XcodeGen `project.yml` / Swift Package) and run on the simulator. No in-app preview — Xcode/simulator is the target.",
  }),
];

export const TEMPLATE_BY_ID: Record<string, TemplateDef> = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));
export const DEFAULT_TEMPLATE = "custom";

export function getTemplate(id: string | undefined): TemplateDef {
  return (id && TEMPLATE_BY_ID[id]) || TEMPLATE_BY_ID[DEFAULT_TEMPLATE];
}
