# Hivey Code — Security & Hardening

Defensive posture of Hivey Code (app.hivey.be) and its hardened runner. This maps each hardening
measure to **what is implemented in the product today** vs **what is recommended when operating at
scale** (external services you wire in yourself). Nothing here weakens existing behaviour.

## Threat model in one line
Hivey Code is **BYOK and client-side**: the user's API keys and projects live in *their* browser
(`localStorage` / IndexedDB), never on our server. The server only handles data **in transit** (LLM
proxy) and runs untrusted generated code inside an **isolated, network-less** container.

---

## 1. File / GitHub uploads

| Measure | Status | Where |
|---|---|---|
| Ephemeral, **network-less** build containers | ✅ Implemented | `/opt/hivey-runner` — every job runs `--network none` (except the two scanners), non-root, read-only rootfs, `--cap-drop ALL`, `--no-new-privileges`, mem/PID/CPU limits, wall-clock timeout, output cap. |
| **Extension allow-list** on import | ✅ Implemented | `src/lib/importFiles.ts` — only text/code/config extensions (`TEXT_EXT`) are inlined; binaries go to an asset *manifest* (never executed); junk dirs/lockfiles filtered. |
| **Refuse executables/installers** | ✅ Implemented | `importFiles.ts` `DANGEROUS_EXT` — `.exe/.dll/.so/.msi/.apk/.dmg/.iso/.jar/…` are skipped on file, folder and `.zip` import. |
| **Dependency vulnerability scan** (Dependabot/Snyk-equiv) | ✅ Implemented | Security tab → **Deep scan** runs `npm audit` in the runner (`/api/deepscan`). |
| **Static analysis** (SonarQube/ESLint-equiv) | ✅ Implemented | Deep scan also runs **semgrep** (`p/javascript · typescript · react · secrets · owasp-top-ten`). |
| **Anti-malware (ClamAV)** on uploads | ⚙️ Recommended at scale | Add a `clamscan` task to the runner image (bundle `freshclam` DB at build time) and call it from `/api/deepscan`. Not enabled by default because imports are source text, never executed. |
| **Minimal-scope GitHub tokens** | ⚙️ Operator responsibility | GitHub import is read-only clone (isomorphic-git). Use a **read-only, repo-scoped PAT**; never a full-access token. |

## 2. AI code generation

| Measure | Status | Where |
|---|---|---|
| **Secret detection** (GitGuardian-equiv) | ✅ Implemented | Security tab → **Quick scan** (`src/lib/quickScan.ts`) — instant regex scan for hardcoded keys (OpenAI/AWS/Google/GitHub/Slack/Stripe, private keys, credential assignments). |
| **Block risky patterns** (`eval()` via regex …) | ✅ Implemented (as findings) | Quick scan flags `eval`, `new Function`, shell `exec`/`child_process`, `dangerouslySetInnerHTML`, `innerHTML=`, `document.write`. Surfaced as high/medium findings; a build is never *silently* shipped with them. |
| **Pipeline scan in the build** | ✅ Implemented | Deep scan (semgrep + npm audit) runs in the hardened runner. |
| **Restrict libraries during generation** | ✅ Implemented | Preview runs in the Sandpack **nodebox** with only its tested toolchain + the project's declared runtime deps (`customSetup`); it can't reach the host or network. |
| **AI safety framing** | ✅ Implemented | The defensive Security agent (`SECURITY_SYSTEM`) refuses offensive/exploit requests. |

## 3. Access & data

| Measure | Status | Notes |
|---|---|---|
| **MFA** | N/A by design | Hivey Code has **no accounts / no login** — it's BYOK, keys live in the browser. There is no server-side identity to protect with MFA. (The provider behind the key enforces its own auth/MFA.) |
| **Encryption at rest (AES-256, S3/KMS)** | N/A by design | We **store no user files/keys server-side**. Projects + keys are in the user's browser storage. Published apps live under `/srv/hivey-deploys` (public static output only). Enable full-disk encryption on the VPS for defence-in-depth. |
| **Keys never logged / exposed** | ✅ Implemented | BYOK keys are sent per-request to the LLM endpoint and never persisted or logged (verified). The runner audit log contains **job metadata only** — no file contents, no secrets. |
| **Audit logging → SIEM (ELK)** | ✅ Implemented (base) | The runner emits one **structured JSON audit line per job** (`{audit:"job", ts, task, files, exitCode, ok, timedOut, durationMs}`) — tail `journalctl -u hivey-runner` into Filebeat/ELK. |
| **Deployed apps on a separate origin** | ✅ Implemented | `deploys.hivey.be` ≠ `app.hivey.be`, so a generated app can't read the sidebar/app `localStorage` (the key). |

---

## 4. Incident response runbook

If suspicious activity is detected (anomalous runner jobs, unexpected outbound from a scanner task,
a leaked key):

1. **Isolate** — `systemctl stop hivey-runner` to halt all builds/scans; take the affected project
   offline (`rm` its dir under `/srv/hivey-deploys`, reload Caddy). No new jobs can run while stopped.
2. **Analyse logs** — `journalctl -u hivey-runner --since "-2h"`; grep the JSON audit lines for
   unusual `task`/`durationMs`/`net:true` activity. Look for `exec`/external-connection patterns in
   any imported code with a **Quick scan** / **Deep scan**.
3. **Revoke & rotate** — revoke any exposed GitHub token on GitHub, rotate any provider API key
   flagged by Quick scan, and rotate server secrets. BYOK keys are the user's — advise rotation.
4. **Report** — record timeline, affected project id, indicators and remediation for forensics and
   prevention. Keep the audit log excerpt.

**Containment guarantees that make this cheap:** jobs are ephemeral (`--rm`) and network-less by
default, so stopping the service fully contains code execution; there is no persistent server-side
store of user data to exfiltrate.

---

## Reporting a vulnerability
Email the maintainer (florian.martins@…) with steps to reproduce. Please do not open a public issue
for anything exploitable.
