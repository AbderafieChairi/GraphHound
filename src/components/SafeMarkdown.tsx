import { Fragment } from "react";

function inline(text: string) {
  const escaped = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return escaped.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code key={index} className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
          {part.slice(1, -1)}
        </code>
      );
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function SafeMarkdown({ source }: { source: string }) {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  return (
    <div className="flex flex-col gap-2 text-xs leading-6 text-foreground/90">
      {lines.map((line, index) => {
        if (!line.trim()) return <div key={index} className="h-1" />;
        if (line.startsWith("### "))
          return (
            <h4 key={index} className="font-semibold">
              {inline(line.slice(4))}
            </h4>
          );
        if (line.startsWith("## "))
          return (
            <h3 key={index} className="text-sm font-semibold">
              {inline(line.slice(3))}
            </h3>
          );
        if (line.startsWith("# "))
          return (
            <h2 key={index} className="text-base font-semibold">
              {inline(line.slice(2))}
            </h2>
          );
        if (/^[-*] /.test(line))
          return (
            <li key={index} className="ml-4 list-disc">
              {inline(line.slice(2))}
            </li>
          );
        if (/^\d+\. /.test(line))
          return (
            <li key={index} className="ml-4 list-decimal">
              {inline(line.replace(/^\d+\. /, ""))}
            </li>
          );
        if (line.startsWith("> "))
          return (
            <blockquote
              key={index}
              className="border-l-2 border-primary/50 pl-3 text-muted-foreground"
            >
              {inline(line.slice(2))}
            </blockquote>
          );
        return <p key={index}>{inline(line)}</p>;
      })}
    </div>
  );
}
