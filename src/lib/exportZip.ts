"use client";

import type { FileMap } from "@/agent/types";

// Zip the whole project (client-side, jszip loaded on demand) and trigger a browser download.
export async function downloadProjectZip(files: FileMap, name = "hivey-project"): Promise<void> {
  const entries = Object.entries(files);
  if (!entries.length) return;
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const [path, content] of entries) zip.file(path.replace(/^\.?\//, ""), content ?? "");
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
