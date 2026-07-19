import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hivey Code",
  description: "Hivey Code — an agentic AI app builder (planner · coder · reviewer · debugger · tester).",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
