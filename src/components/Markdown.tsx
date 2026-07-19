"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Rich rendering for assistant replies — headings, bold, lists, links, inline & block code.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
