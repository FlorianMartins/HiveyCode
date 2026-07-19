// Fast, offline, client-side security scan of the project files. Pure regex — no key, no network, no
// LLM — so it's an instant first line of defence that complements the AI scan and the runner deep scan.
// Covers two families: HARDCODED SECRETS (GitGuardian-style) and DANGEROUS CODE PATTERNS (eval & co.).
import type { FileMap, SecurityFinding } from "@/agent/types";

interface Rule {
  re: RegExp;
  title: string;
  category: string;
  severity: "high" | "medium" | "low";
  why: string;
  fix: string;
}

// Secret detectors — provider key formats + generic "secret = '<long literal>'" assignments.
const SECRET_RULES: Rule[] = [
  { re: /\b(sk-[A-Za-z0-9_-]{20,})\b/, title: "Hardcoded API key (sk-…)", category: "secret", severity: "high", why: "An OpenAI/Anthropic-style secret key is committed in the source.", fix: "Move it to an env var / user input; rotate the exposed key immediately." },
  { re: /\bAKIA[0-9A-Z]{16}\b/, title: "Hardcoded AWS access key", category: "secret", severity: "high", why: "An AWS access key id is in the source.", fix: "Remove it, rotate the key in IAM, and use env vars / a secrets manager." },
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/, title: "Hardcoded Google API key", category: "secret", severity: "high", why: "A Google API key is in the source.", fix: "Remove and rotate it; restrict the key and load it from config." },
  { re: /\bgh[posru]_[A-Za-z0-9]{30,}\b/, title: "Hardcoded GitHub token", category: "secret", severity: "high", why: "A GitHub personal-access/OAuth token is in the source.", fix: "Revoke the token on GitHub and use a minimal-scope, env-provided token." },
  { re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/, title: "Hardcoded Slack token", category: "secret", severity: "high", why: "A Slack token is in the source.", fix: "Revoke and rotate it; load from env." },
  { re: /\bsk_live_[0-9a-zA-Z]{20,}\b/, title: "Hardcoded Stripe live key", category: "secret", severity: "high", why: "A live Stripe secret key is in the source.", fix: "Roll the key in the Stripe dashboard; never ship secret keys to the client." },
  { re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/, title: "Embedded private key", category: "secret", severity: "high", why: "A private key is embedded in the source.", fix: "Remove it, rotate the key pair, and store keys outside the repo." },
  { re: /\b(?:api[_-]?key|secret|passwd|password|access[_-]?token|auth[_-]?token)\b\s*[:=]\s*["'][^"'\s]{12,}["']/i, title: "Hardcoded credential in an assignment", category: "secret", severity: "medium", why: "A credential-looking name is assigned a long string literal.", fix: "Load it from an environment variable or secure input instead of hardcoding." },
];

// Dangerous code patterns — the "block eval() via regex" family + risky sinks.
const CODE_RULES: Rule[] = [
  { re: /\beval\s*\(/, title: "Use of eval()", category: "injection", severity: "high", why: "eval() executes arbitrary code and enables injection if fed any untrusted data.", fix: "Remove eval(); parse/dispatch explicitly (JSON.parse, a lookup map, etc.)." },
  { re: /\bnew\s+Function\s*\(/, title: "Dynamic code via new Function()", category: "injection", severity: "high", why: "new Function() compiles a string into code — same risk as eval().", fix: "Avoid dynamic code generation; use explicit logic." },
  { re: /\bchild_process\b|\bexecSync\s*\(|\.exec\s*\(\s*[`'"]?\$?\{?/, title: "Shell command execution", category: "injection", severity: "high", why: "Spawning shell commands with interpolated input risks command injection.", fix: "Avoid shell exec; if unavoidable, use an argv array and never interpolate user input." },
  { re: /dangerouslySetInnerHTML/, title: "dangerouslySetInnerHTML", category: "xss", severity: "medium", why: "Injecting raw HTML can lead to XSS if the value isn't sanitised.", fix: "Render text instead, or sanitise with DOMPurify before injecting." },
  { re: /\.innerHTML\s*=(?!\s*["'`]\s*["'`])/, title: "Assignment to innerHTML", category: "xss", severity: "low", why: "Writing to innerHTML with dynamic data can introduce XSS.", fix: "Use textContent, or sanitise the HTML (DOMPurify) first." },
  { re: /\bdocument\.write\s*\(/, title: "document.write()", category: "xss", severity: "low", why: "document.write with dynamic content is an XSS and performance risk.", fix: "Build DOM nodes / use textContent instead." },
];

const ALL = [...SECRET_RULES, ...CODE_RULES];
// Skip obvious placeholders so we don't cry wolf on examples.
const PLACEHOLDER = /(your[_-]?|example|placeholder|xxxx|<[^>]+>|changeme|dummy|test[_-]?key|1234567890)/i;

export function quickScan(files: FileMap): SecurityFinding[] {
  const out: SecurityFinding[] = [];
  let i = 0;
  for (const [path, content] of Object.entries(files)) {
    if (path === "package-lock.json" || /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|map)$/i.test(path)) continue;
    const lines = content.split("\n");
    for (let ln = 0; ln < lines.length; ln++) {
      const line = lines[ln];
      if (line.length > 2000) continue; // skip minified/huge lines
      for (const rule of ALL) {
        const m = rule.re.exec(line);
        if (!m) continue;
        if (rule.category === "secret" && PLACEHOLDER.test(m[0])) continue;
        out.push({
          id: `quick-${i++}`,
          severity: rule.severity,
          title: rule.title,
          file: path.replace(/^\.?\//, ""),
          line: ln + 1,
          category: rule.category,
          why: rule.why,
          fix: rule.fix,
          status: "open",
        });
        break; // one finding per line is enough
      }
    }
  }
  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
