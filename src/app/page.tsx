import { Topbar } from "@/components/Topbar";
import { Workspace } from "@/components/Workspace";
import { CommandPalette } from "@/components/CommandPalette";

export default function Home() {
  return (
    <main className="flex h-screen flex-col overflow-hidden">
      <Topbar />
      <Workspace />
      <CommandPalette />
    </main>
  );
}
