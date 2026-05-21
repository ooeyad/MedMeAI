import { ReactNode } from "react";

/**
 * Lightweight Markdown renderer for chat bubbles.
 *
 * Supports the common cases the AI produces:
 *  - **bold** / __bold__
 *  - *italic* / _italic_
 *  - `inline code`
 *  - bullets:  `- item`, `* item`, `• item`
 *  - numbered: `1. item`
 *  - headers:  `# H1` / `## H2` / `### H3`
 *  - blank line → paragraph break
 *
 * Deliberately doesn't handle links / images / tables / code blocks — for those
 * we can switch to react-markdown later.
 */
export function ChatMarkdown({ content }: { content: string }) {
  if (!content) return null;

  const blocks = splitIntoBlocks(content);
  return (
    <div className="space-y-2 leading-relaxed">
      {blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </div>
  );
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "h"; level: 1 | 2 | 3; text: string };

function splitIntoBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let buf: Block | null = null;

  const flush = () => { if (buf) { blocks.push(buf); buf = null; } };

  for (const raw of lines) {
    const line = raw;
    const trimmed = line.trim();

    // Blank line → flush
    if (trimmed === "") { flush(); continue; }

    // Headers
    const h = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (h) {
      flush();
      blocks.push({ kind: "h", level: h[1].length as 1 | 2 | 3, text: h[2] });
      continue;
    }

    // Numbered list
    const numbered = /^(\d+)[.)]\s+(.+)$/.exec(trimmed);
    if (numbered) {
      if (buf?.kind !== "ol") { flush(); buf = { kind: "ol", items: [] }; }
      (buf as { kind: "ol"; items: string[] }).items.push(numbered[2]);
      continue;
    }

    // Bulleted list (- * • +)
    const bullet = /^[•\-*+]\s+(.+)$/.exec(trimmed);
    if (bullet) {
      if (buf?.kind !== "ul") { flush(); buf = { kind: "ul", items: [] }; }
      (buf as { kind: "ul"; items: string[] }).items.push(bullet[1]);
      continue;
    }

    // Paragraph continuation
    if (buf?.kind === "p") {
      (buf as { kind: "p"; lines: string[] }).lines.push(trimmed);
    } else {
      flush();
      buf = { kind: "p", lines: [trimmed] };
    }
  }
  flush();
  return blocks;
}

function Block({ block }: { block: Block }) {
  switch (block.kind) {
    case "h": {
      const sizes = {
        1: "text-base font-semibold",
        2: "text-sm font-semibold",
        3: "text-sm font-medium",
      } as const;
      return <div className={sizes[block.level]}>{renderInline(block.text)}</div>;
    }
    case "ul":
      return (
        <ul className="list-disc list-outside pl-5 space-y-0.5">
          {block.items.map((it, i) => (
            <li key={i}>{renderInline(it)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="list-decimal list-outside pl-5 space-y-0.5">
          {block.items.map((it, i) => (
            <li key={i}>{renderInline(it)}</li>
          ))}
        </ol>
      );
    case "p":
    default:
      return <p>{renderInline(block.lines.join(" "))}</p>;
  }
}

// Inline parsing — bold, italic, code. Order matters; bold before italic.
function renderInline(text: string): ReactNode[] {
  // Pattern matches: **bold**, __bold__, *italic*, _italic_, `code`
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*]+)\*|_([^_]+)_)/g;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const [, , bold1, bold2, code, ital1, ital2] = m;
    if (bold1 || bold2) {
      out.push(<strong key={key++} className="font-semibold">{bold1 || bold2}</strong>);
    } else if (code) {
      out.push(
        <code key={key++} className="font-mono text-[0.85em] px-1 py-0.5 rounded bg-ink-100 text-ink-800">
          {code}
        </code>
      );
    } else if (ital1 || ital2) {
      out.push(<em key={key++} className="italic">{ital1 || ital2}</em>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
