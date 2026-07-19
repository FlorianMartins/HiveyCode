import FS from "@isomorphic-git/lightning-fs";
import * as git from "isomorphic-git";
import type { FileMap } from "@/agent/types";

/**
 * Real Git for the in-browser project — a genuine repository (not snapshots), in an IndexedDB-backed
 * filesystem so history survives reloads. SCOPED PER PROJECT: each project has its own repo dir
 * (/p-<projectId>) with its own .git, so switching projects keeps their histories separate.
 */
const AUTHOR = { name: "Hivey", email: "agent@hivey.be" };
const dirFor = (projectId: string) => `/p-${projectId || "default"}`;

let _fs: FS | null = null;
function fs(): FS {
  if (!_fs) _fs = new FS("hivey-git");
  return _fs;
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs().promises.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function mkdirp(path: string) {
  const parts = path.split("/").filter(Boolean);
  let cur = "";
  for (const p of parts) {
    cur += "/" + p;
    if (!(await exists(cur))) {
      try {
        await fs().promises.mkdir(cur);
      } catch {}
    }
  }
}

async function ensureRepo(dir: string) {
  if (!(await exists(dir))) await fs().promises.mkdir(dir);
  if (!(await exists(`${dir}/.git`))) await git.init({ fs: fs(), dir, defaultBranch: "main" });
}

export async function commitProject(files: FileMap, message: string, projectId: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const dir = dirFor(projectId);
  try {
    await ensureRepo(dir);

    for (const [p, content] of Object.entries(files)) {
      const full = `${dir}/${p}`;
      await mkdirp(full.slice(0, full.lastIndexOf("/")));
      await fs().promises.writeFile(full, content);
    }

    let tracked: string[] = [];
    try {
      tracked = await git.listFiles({ fs: fs(), dir });
    } catch {}
    for (const t of tracked) {
      if (!(t in files)) {
        try {
          await fs().promises.unlink(`${dir}/${t}`);
        } catch {}
        try {
          await git.remove({ fs: fs(), dir, filepath: t });
        } catch {}
      }
    }

    for (const p of Object.keys(files)) await git.add({ fs: fs(), dir, filepath: p });

    return await git.commit({ fs: fs(), dir, message: (message || "update").slice(0, 200), author: AUTHOR });
  } catch {
    return null;
  }
}

export interface GitCommit {
  oid: string;
  message: string;
  ts: number;
  files: number;
}

export async function gitLog(projectId: string): Promise<GitCommit[]> {
  if (typeof window === "undefined") return [];
  const dir = dirFor(projectId);
  try {
    await ensureRepo(dir);
    const log = await git.log({ fs: fs(), dir, depth: 60 });
    const out: GitCommit[] = [];
    for (const c of log) {
      let n = 0;
      try {
        n = (await git.listFiles({ fs: fs(), dir, ref: c.oid })).length;
      } catch {}
      out.push({ oid: c.oid, message: c.commit.message.trim(), ts: c.commit.author.timestamp * 1000, files: n });
    }
    return out;
  } catch {
    return [];
  }
}

export async function filesAtCommit(oid: string, projectId: string): Promise<FileMap> {
  const dir = dirFor(projectId);
  const out: FileMap = {};
  try {
    await ensureRepo(dir);
    const list = await git.listFiles({ fs: fs(), dir, ref: oid });
    for (const filepath of list) {
      const { blob } = await git.readBlob({ fs: fs(), dir, oid, filepath });
      out[filepath] = new TextDecoder().decode(blob);
    }
  } catch {}
  return out;
}
