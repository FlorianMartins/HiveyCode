// Shared abort handle so a single Stop button can cancel whichever agent run is in flight
// (Chat build or OpenClaude terminal). Aborting the fetch stops the client reading the stream.
let active: AbortController | null = null;

export function newAbort(): AbortController {
  active = new AbortController();
  return active;
}

export function stopActive() {
  try {
    active?.abort();
  } catch {}
  active = null;
}

export function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === "AbortError";
}
