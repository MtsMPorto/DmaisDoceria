import type { ReactNode } from "react";

export function WhatsAppMessage({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-0.5">
      {lines.map((line, li) => {
        const parts: ReactNode[] = [];
        let remaining = line;
        let key = 0;
        while (remaining.length > 0) {
          const boldMatch = remaining.match(/^\*([^*]+)\*/);
          const italicMatch = remaining.match(/^_([^_]+)_/);
          if (boldMatch) {
            parts.push(<strong key={key++} className="font-black text-[#1A2B6B]">{boldMatch[1]}</strong>);
            remaining = remaining.slice(boldMatch[0].length);
          } else if (italicMatch) {
            parts.push(<em key={key++} className="italic text-gray-400 text-xs">{italicMatch[1]}</em>);
            remaining = remaining.slice(italicMatch[0].length);
          } else {
            const nextSpecial = remaining.search(/[*_]/);
            if (nextSpecial === -1) { parts.push(<span key={key++}>{remaining}</span>); remaining = ""; }
            else { parts.push(<span key={key++}>{remaining.slice(0, nextSpecial)}</span>); remaining = remaining.slice(nextSpecial); }
          }
        }
        return <p key={li} className={`leading-snug text-sm ${line === "" ? "h-2" : ""}`}>{parts.length > 0 ? parts : <>&nbsp;</>}</p>;
      })}
    </div>
  );
}
