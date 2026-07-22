/**
 * The editor's web page, as one self-contained string.
 *
 * Fully inline — no CDN, no remote font, no network of any kind. It has to load
 * on a plane, inside Expo Go, from a `source={{ html }}` prop.
 *
 * The page is deliberately dumb. It owns a contenteditable DOM and nothing else:
 * it never sees markdown, never decides what a document means, and posts its raw
 * innerHTML across the bridge for the pure, tested converter in ./markdown.ts to
 * interpret. Everything that could corrupt a manuscript lives on the other side.
 */
import { colors, radius, space } from '@/theme/tokens';

/** Messages the page posts to React Native. */
export type EditorMessage =
  | { type: 'ready'; html: string }
  | { type: 'change'; html: string }
  | { type: 'error'; message: string };

export function parseEditorMessage(raw: string): EditorMessage | null {
  try {
    const parsed = JSON.parse(raw) as EditorMessage;
    if (parsed && (parsed.type === 'ready' || parsed.type === 'change' || parsed.type === 'error')) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** How long the page waits after a keystroke before posting. The store debounces
 *  the SAVE; this only debounces the bridge, so it stays short. */
const EMIT_DELAY_MS = 120;

export function buildEditorHtml(initialHtml: string, editable: boolean): string {
  // The document body is injected as a JSON string, not spliced into markup, so
  // a manuscript containing "</div>" cannot break the page.
  const initial = JSON.stringify(initialHtml);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  :root { color-scheme: dark; }
  html, body {
    margin: 0; padding: 0; height: 100%;
    background: ${colors.bg}; color: ${colors.text};
    -webkit-text-size-adjust: 100%;
  }
  body { display: flex; flex-direction: column; }
  #toolbar {
    display: ${editable ? 'flex' : 'none'};
    gap: ${space.xs}px;
    padding: ${space.sm}px ${space.md}px;
    background: ${colors.surface};
    border-bottom: 1px solid ${colors.border};
    overflow-x: auto; -webkit-overflow-scrolling: touch;
    flex: 0 0 auto;
  }
  /* Words, not glyphs: a 16px "B" gets misread, and an active state you can only
     see as a slightly different grey is not a state the writer can read. */
  #toolbar button {
    flex: 0 0 auto;
    font: 600 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: ${colors.textMuted};
    background: ${colors.surfaceAlt};
    border: 1px solid ${colors.border};
    border-radius: ${radius.sm}px;
    padding: 9px 12px;
    min-height: 34px;
  }
  #toolbar button.on {
    background: ${colors.primary};
    border-color: ${colors.primary};
    color: ${colors.primaryText};
  }
  #doc {
    flex: 1 1 auto;
    overflow-y: auto; -webkit-overflow-scrolling: touch;
    padding: ${space.lg}px ${space.lg}px 45vh ${space.lg}px;
    outline: none;
    /* pre-wrap so the writer's own spacing survives a round trip. */
    white-space: pre-wrap;
    word-wrap: break-word;
    font: 17px/1.55 Georgia, "Times New Roman", "Iowan Old Style", serif;
    caret-color: ${colors.primary};
  }
  #doc p { margin: 0 0 ${space.lg}px 0; }
  #doc h1, #doc h2, #doc h3, #doc h4, #doc h5, #doc h6 {
    margin: ${space.xl}px 0 ${space.md}px 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.25;
  }
  #doc h1 { font-size: 26px; } #doc h2 { font-size: 22px; } #doc h3 { font-size: 19px; }
  #doc h4, #doc h5, #doc h6 { font-size: 17px; }
  #doc :first-child { margin-top: 0; }
  ::selection { background: ${colors.primary}66; }
</style>
</head>
<body>
<div id="toolbar">
  <button type="button" data-cmd="bold">Bold</button>
  <button type="button" data-cmd="italic">Italic</button>
  <button type="button" data-block="h1">Title</button>
  <button type="button" data-block="h2">Heading</button>
  <button type="button" data-block="p">Body</button>
</div>
<div id="doc" contenteditable="${editable ? 'true' : 'false'}" spellcheck="true" autocorrect="on"></div>
<script>
(function () {
  var doc = document.getElementById('doc');
  var toolbar = document.getElementById('toolbar');
  var timer = null;

  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }

  try {
    doc.innerHTML = ${initial};
    // Paragraphs, not divs: it keeps the HTML we have to parse boring.
    document.execCommand('defaultParagraphSeparator', false, 'p');
    // Semantic tags, not <span style="font-weight:bold">, which we would drop.
    document.execCommand('styleWithCSS', false, false);
  } catch (e) {
    post({ type: 'error', message: 'Could not open the document in the editor.' });
  }

  function emit() {
    timer = null;
    post({ type: 'change', html: doc.innerHTML });
  }

  function scheduleEmit() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(emit, ${EMIT_DELAY_MS});
  }

  // Text that grows has to stay on screen AS it grows, not only when it opens.
  function keepCaretVisible() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    var rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect || (rect.top === 0 && rect.bottom === 0)) return;
    var limit = doc.getBoundingClientRect().bottom - 24;
    if (rect.bottom > limit) doc.scrollTop += rect.bottom - limit + 24;
    if (rect.top < doc.getBoundingClientRect().top + 8) {
      doc.scrollTop -= doc.getBoundingClientRect().top + 8 - rect.top;
    }
  }

  // iOS does NOT shrink a WKWebView's layout viewport when the keyboard opens —
  // 100% stays 100%, and the line being typed ends up underneath the keyboard.
  // The visual viewport is the only thing that knows the truth.
  function fitToViewport() {
    var vv = window.visualViewport;
    if (!vv) return;
    document.body.style.height = vv.height + 'px';
    keepCaretVisible();
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fitToViewport);
    window.visualViewport.addEventListener('scroll', fitToViewport);
    fitToViewport();
  }

  doc.addEventListener('input', function () {
    scheduleEmit();
    keepCaretVisible();
    syncToolbar();
  });

  // Pasted rich text is formatting we do not support and would silently drop —
  // so it arrives as plain text and the writer can see exactly what landed.
  doc.addEventListener('paste', function (e) {
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  });

  function blockTag() {
    var node = window.getSelection() && window.getSelection().anchorNode;
    while (node && node !== doc) {
      if (node.nodeType === 1 && /^(P|H[1-6]|DIV)$/.test(node.tagName)) {
        return node.tagName.toLowerCase();
      }
      node = node.parentNode;
    }
    return null;
  }

  function syncToolbar() {
    var block = blockTag();
    var buttons = toolbar.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var on = false;
      if (b.dataset.cmd) {
        try { on = document.queryCommandState(b.dataset.cmd); } catch (e) { on = false; }
      } else if (b.dataset.block) {
        on = b.dataset.block === 'p' ? (block === 'p' || block === 'div' || block === null)
                                     : block === b.dataset.block;
      }
      if (on) b.classList.add('on'); else b.classList.remove('on');
    }
  }

  toolbar.addEventListener('mousedown', function (e) {
    // Never let the button steal focus — losing the selection is losing the
    // thing the writer was about to format.
    if (e.target && e.target.tagName === 'BUTTON') e.preventDefault();
  });

  toolbar.addEventListener('click', function (e) {
    var b = e.target;
    if (!b || b.tagName !== 'BUTTON') return;
    e.preventDefault();
    doc.focus();
    if (b.dataset.cmd) {
      document.execCommand(b.dataset.cmd, false, null);
    } else if (b.dataset.block) {
      document.execCommand('formatBlock', false, '<' + b.dataset.block + '>');
    }
    syncToolbar();
    scheduleEmit();
  });

  document.addEventListener('selectionchange', syncToolbar);

  // Replace the whole document from the app side (a load, or accepted edits).
  // Deliberately NOT an "emit" — the app already knows this text.
  window.__setHtml = function (html) {
    if (timer) { clearTimeout(timer); timer = null; }
    doc.innerHTML = html;
    syncToolbar();
  };

  window.__setEditable = function (on) {
    doc.setAttribute('contenteditable', on ? 'true' : 'false');
    toolbar.style.display = on ? 'flex' : 'none';
  };

  // Flush without waiting out the bridge debounce.
  window.__emitNow = function () { if (timer) { clearTimeout(timer); } emit(); };

  syncToolbar();
  post({ type: 'ready', html: doc.innerHTML });
})();
</script>
</body>
</html>`;
}
