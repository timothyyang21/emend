/**
 * markdown ↔ HTML, as pure functions.
 *
 * WHY THIS IS NOT INSIDE THE WEBVIEW: this is the code that can silently corrupt
 * someone's manuscript. It has to be runnable — and provable — in jest, with no
 * browser anywhere near it. The webview owns a contenteditable DOM and nothing
 * else; every byte that crosses the bridge passes through here.
 *
 * THE GUARANTEE WE ACTUALLY MAKE. For normalised markdown — which is what
 * `normalizeMarkdown` produces, and what SAMPLE_MARKDOWN already is —
 *
 *     htmlToMarkdown(markdownToHtml(md)) === md
 *
 * exactly. Loading a document and touching nothing therefore cannot change the
 * string, so autosave stays quiet and the diff shows no phantom hunks. For
 * arbitrary input the first pass normalises (see `normalizeMarkdown` for the
 * three things it touches) and every pass after that is a fixed point.
 *
 * THE SUPPORTED SUBSET IS DELIBERATELY TINY: ATX headings, paragraphs, `**bold**`,
 * `*italic*`. Everything else — underscores, backticks, brackets, links, lists —
 * is carried through as literal text, unchanged. That is the safe failure mode:
 * a writer who typed `snake_case`, `2 * 3`, or `[see p.40]` gets those characters
 * back byte for byte rather than getting them "interpreted".
 */

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'em'; kids: Inline[] }
  | { t: 'strong'; kids: Inline[] }
  | { t: 'br' };

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type Block =
  | { t: 'heading'; level: HeadingLevel; kids: Inline[] }
  | { t: 'paragraph'; kids: Inline[] };

const HEADING_RE = /^(#{1,6})[ \t]+(.*)$/;

// ---------------------------------------------------------------------------
// markdown → blocks
// ---------------------------------------------------------------------------

/** Emphasis, innermost-first. Each requires non-space just inside the run, which
 *  is what keeps `2 * 3 * 4` and a lone `*` from becoming formatting. */
const STRONG_EM_RE = /\*\*\*(\S(?:[\s\S]*?\S)?)\*\*\*/;
const STRONG_RE = /\*\*(\S(?:[\s\S]*?\S)?)\*\*/;
const EM_RE = /\*(\S(?:[\s\S]*?\S)?)\*/;

function parseInline(text: string): Inline[] {
  if (text === '') return [];

  // Earliest match wins; on a tie the longest delimiter wins, so `***x***` is
  // read as strong-inside-em rather than as em followed by junk.
  const candidates: { re: RegExp; wrap: (kids: Inline[]) => Inline }[] = [
    { re: STRONG_EM_RE, wrap: (kids) => ({ t: 'strong', kids: [{ t: 'em', kids }] }) },
    { re: STRONG_RE, wrap: (kids) => ({ t: 'strong', kids }) },
    { re: EM_RE, wrap: (kids) => ({ t: 'em', kids }) },
  ];

  let best: { index: number; length: number; inner: string; wrap: (k: Inline[]) => Inline } | null =
    null;
  for (const c of candidates) {
    const m = c.re.exec(text);
    if (!m) continue;
    if (best === null || m.index < best.index) {
      best = { index: m.index, length: m[0].length, inner: m[1], wrap: c.wrap };
    }
  }

  if (best === null) return [{ t: 'text', v: text }];

  const out: Inline[] = [];
  if (best.index > 0) out.push({ t: 'text', v: text.slice(0, best.index) });
  out.push(best.wrap(parseInline(best.inner)));
  out.push(...parseInline(text.slice(best.index + best.length)));
  return out;
}

/** Paragraph text keeps its internal newlines: a hard-wrapped manuscript must
 *  come back hard-wrapped, or every paragraph becomes a phantom diff hunk. */
function parseParagraphInline(lines: string[]): Inline[] {
  const kids: Inline[] = [];
  lines.forEach((line, i) => {
    if (i > 0) kids.push({ t: 'br' });
    kids.push(...parseInline(line));
  });
  return kids;
}

export function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];

  const flush = () => {
    if (para.length > 0) {
      blocks.push({ t: 'paragraph', kids: parseParagraphInline(para) });
      para = [];
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/[ \t]+$/, '');
    if (line.trim() === '') {
      flush();
      continue;
    }
    const heading = HEADING_RE.exec(line);
    if (heading) {
      flush();
      blocks.push({
        t: 'heading',
        level: heading[1].length as HeadingLevel,
        kids: parseInline(heading[2].replace(/[ \t]+$/, '')),
      });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

// ---------------------------------------------------------------------------
// blocks → markdown
// ---------------------------------------------------------------------------

/**
 * Whitespace can never sit between an emphasis marker and its text — `** bold **`
 * is not bold, it is four literal asterisks. So it gets hoisted outside the run.
 */
function wrapEmphasis(inner: string, marker: string): string {
  if (inner.trim() === '') return inner;
  const lead = /^\s*/.exec(inner)?.[0] ?? '';
  const tail = /\s*$/.exec(inner)?.[0] ?? '';
  return `${lead}${marker}${inner.slice(lead.length, inner.length - tail.length)}${marker}${tail}`;
}

export function inlineToMarkdown(kids: Inline[]): string {
  return kids
    .map((node) => {
      switch (node.t) {
        case 'text':
          return node.v;
        case 'br':
          return '\n';
        case 'strong':
          return wrapEmphasis(inlineToMarkdown(node.kids), '**');
        case 'em':
          return wrapEmphasis(inlineToMarkdown(node.kids), '*');
      }
    })
    .join('');
}

export function blocksToMarkdown(blocks: Block[]): string {
  const rendered = blocks
    .map((b) => {
      const body = inlineToMarkdown(b.kids)
        .split('\n')
        .map((line) => line.replace(/[ \t]+$/, ''))
        .join('\n')
        .replace(/\n+$/, '');
      if (body.trim() === '') return '';
      // A heading is one line by definition; a stray break inside one would
      // serialise to markdown that reads back as a heading plus a paragraph.
      return b.t === 'heading'
        ? `${'#'.repeat(b.level)} ${body.replace(/\n+/g, ' ')}`
        : body;
    })
    .filter((s) => s !== '');

  return rendered.length === 0 ? '' : `${rendered.join('\n\n')}\n`;
}

/**
 * The canonical form of a document. Three things get touched, once, on the way
 * in — runs of blank lines collapse to one, trailing spaces on a line go, and
 * the document ends in exactly one newline. Everything else is byte-identical,
 * and normalising twice changes nothing.
 */
export function normalizeMarkdown(markdown: string): string {
  return blocksToMarkdown(parseMarkdown(markdown));
}

// ---------------------------------------------------------------------------
// blocks → HTML
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineToHtml(kids: Inline[]): string {
  return kids
    .map((node) => {
      switch (node.t) {
        case 'text':
          return escapeHtml(node.v);
        case 'br':
          return '<br>';
        case 'strong':
          return `<strong>${inlineToHtml(node.kids)}</strong>`;
        case 'em':
          return `<em>${inlineToHtml(node.kids)}</em>`;
      }
    })
    .join('');
}

/**
 * No whitespace between block tags, ever: the editor renders with
 * `white-space: pre-wrap` (so the writer's own spacing survives), which would
 * turn a pretty-printed newline between `</p>` and `<p>` into a visible gap.
 */
export function markdownToHtml(markdown: string): string {
  return parseMarkdown(markdown)
    .map((b) =>
      b.t === 'heading'
        ? `<h${b.level}>${inlineToHtml(b.kids)}</h${b.level}>`
        : `<p>${inlineToHtml(b.kids)}</p>`
    )
    .join('');
}

// ---------------------------------------------------------------------------
// HTML → blocks
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  // A contenteditable emits &nbsp; the moment you type two spaces. Decoding it
  // to an ordinary space is what keeps the markdown free of invisible U+00A0.
  nbsp: ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named ?? whole;
  });
}

const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote']);
const STRONG_TAGS = new Set(['strong', 'b']);
const EM_TAGS = new Set(['em', 'i']);

/**
 * A tolerant scanner rather than a DOM. The HTML it is fed comes from a
 * contenteditable, which produces spans, styles, nested divs and pasted junk —
 * anything unrecognised keeps its text and loses its tag, which is exactly the
 * behaviour "minimal formatting only" asks for.
 */
export function parseHtml(html: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  // Stack of kid-lists; index 0 is the current block's own children.
  let stack: Inline[][] = [];
  let names: string[] = [];

  const closeBlock = () => {
    if (current) {
      blocks.push(current);
      current = null;
    }
    stack = [];
    names = [];
  };

  const openBlock = (tag: string) => {
    closeBlock();
    const level = /^h([1-6])$/.exec(tag);
    current = level
      ? { t: 'heading', level: Number(level[1]) as HeadingLevel, kids: [] }
      : { t: 'paragraph', kids: [] };
    stack = [current.kids];
    names = [];
  };

  const ensureBlock = () => {
    if (!current) openBlock('p');
  };

  const push = (node: Inline) => {
    ensureBlock();
    stack[stack.length - 1].push(node);
  };

  const tagRe = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(html)) !== null) {
    if (match.index > cursor) {
      const text = decodeEntities(html.slice(cursor, match.index));
      if (text !== '') push({ t: 'text', v: text });
    }
    cursor = match.index + match[0].length;

    const name = (match[1] ?? '').toLowerCase();
    if (name === '') continue; // comment
    const closing = match[0].startsWith('</');

    if (name === 'br') {
      push({ t: 'br' });
    } else if (BLOCK_TAGS.has(name)) {
      if (closing) closeBlock();
      else openBlock(name);
    } else if (STRONG_TAGS.has(name) || EM_TAGS.has(name)) {
      const t = STRONG_TAGS.has(name) ? 'strong' : 'em';
      if (closing) {
        // Only pop what we actually opened — stray closers are ignored rather
        // than allowed to unwind the block.
        const at = names.lastIndexOf(t);
        if (at !== -1) {
          stack.length = at + 1;
          names.length = at;
        }
      } else {
        const kids: Inline[] = [];
        push({ t, kids });
        stack.push(kids);
        names.push(t);
      }
    }
    // Everything else (span, a, u, font, …) is transparent: its text survives.
  }

  if (cursor < html.length) {
    const text = decodeEntities(html.slice(cursor));
    if (text !== '') push({ t: 'text', v: text });
  }
  closeBlock();
  return blocks;
}

/** The bridge direction: whatever the contenteditable now holds, as markdown. */
export function htmlToMarkdown(html: string): string {
  return blocksToMarkdown(parseHtml(html));
}
