"use client";

import { useStore } from "@/store/useStore";
import { usePersistentNumber } from "@/lib/uiPrefs";
import { Chat } from "./Chat";
import { WorkPanel } from "./WorkPanel";
import { Landing } from "./Landing";
import { Splitter } from "./Splitter";

// Bolt-style flow: a centered hero until the first prompt, then the split IDE (chat | workspace),
// with a draggable divider so the user can resize the chat width.
export function Workspace() {
  const started = useStore((s) => s.chat.length > 0 || Object.keys(s.files).length > 0);
  const [chatW, setChatW] = usePersistentNumber("hivey.ui.chatW", 380);

  if (!started) return <Landing />;

  return (
    <div className="flex min-h-0 flex-1">
      <section style={{ width: chatW }} className="flex shrink-0 flex-col border-r border-border">
        <Chat />
      </section>
      <Splitter dir="x" onDelta={(d) => setChatW((w) => Math.min(680, Math.max(280, w + d)))} />
      <section className="min-w-0 flex-1">
        <WorkPanel />
      </section>
    </div>
  );
}
