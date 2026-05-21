import { jsx as _jsx } from "react/jsx-runtime";
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
export function ChatMarkdown({ content }) {
    if (!content)
        return null;
    const blocks = splitIntoBlocks(content);
    return (_jsx("div", { className: "space-y-2 leading-relaxed", children: blocks.map((b, i) => (_jsx(Block, { block: b }, i))) }));
}
function splitIntoBlocks(text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    let buf = null;
    const flush = () => { if (buf) {
        blocks.push(buf);
        buf = null;
    } };
    for (const raw of lines) {
        const line = raw;
        const trimmed = line.trim();
        // Blank line → flush
        if (trimmed === "") {
            flush();
            continue;
        }
        // Headers
        const h = /^(#{1,3})\s+(.+)$/.exec(trimmed);
        if (h) {
            flush();
            blocks.push({ kind: "h", level: h[1].length, text: h[2] });
            continue;
        }
        // Numbered list
        const numbered = /^(\d+)[.)]\s+(.+)$/.exec(trimmed);
        if (numbered) {
            if (buf?.kind !== "ol") {
                flush();
                buf = { kind: "ol", items: [] };
            }
            buf.items.push(numbered[2]);
            continue;
        }
        // Bulleted list (- * • +)
        const bullet = /^[•\-*+]\s+(.+)$/.exec(trimmed);
        if (bullet) {
            if (buf?.kind !== "ul") {
                flush();
                buf = { kind: "ul", items: [] };
            }
            buf.items.push(bullet[1]);
            continue;
        }
        // Paragraph continuation
        if (buf?.kind === "p") {
            buf.lines.push(trimmed);
        }
        else {
            flush();
            buf = { kind: "p", lines: [trimmed] };
        }
    }
    flush();
    return blocks;
}
function Block({ block }) {
    switch (block.kind) {
        case "h": {
            const sizes = {
                1: "text-base font-semibold",
                2: "text-sm font-semibold",
                3: "text-sm font-medium",
            };
            return _jsx("div", { className: sizes[block.level], children: renderInline(block.text) });
        }
        case "ul":
            return (_jsx("ul", { className: "list-disc list-outside pl-5 space-y-0.5", children: block.items.map((it, i) => (_jsx("li", { children: renderInline(it) }, i))) }));
        case "ol":
            return (_jsx("ol", { className: "list-decimal list-outside pl-5 space-y-0.5", children: block.items.map((it, i) => (_jsx("li", { children: renderInline(it) }, i))) }));
        case "p":
        default:
            return _jsx("p", { children: renderInline(block.lines.join(" ")) });
    }
}
// Inline parsing — bold, italic, code. Order matters; bold before italic.
function renderInline(text) {
    // Pattern matches: **bold**, __bold__, *italic*, _italic_, `code`
    const re = /(\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*]+)\*|_([^_]+)_)/g;
    const out = [];
    let last = 0;
    let m;
    let key = 0;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last)
            out.push(text.slice(last, m.index));
        const [, , bold1, bold2, code, ital1, ital2] = m;
        if (bold1 || bold2) {
            out.push(_jsx("strong", { className: "font-semibold", children: bold1 || bold2 }, key++));
        }
        else if (code) {
            out.push(_jsx("code", { className: "font-mono text-[0.85em] px-1 py-0.5 rounded bg-ink-100 text-ink-800", children: code }, key++));
        }
        else if (ital1 || ital2) {
            out.push(_jsx("em", { className: "italic", children: ital1 || ital2 }, key++));
        }
        last = re.lastIndex;
    }
    if (last < text.length)
        out.push(text.slice(last));
    return out;
}
