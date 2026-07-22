/**
 * The editor page has to work offline, inside Expo Go, with no network at all —
 * one remote font or CDN script and the editor is a blank rectangle on a plane.
 */
import { test, expect } from '@jest/globals';

import { SAMPLE_MARKDOWN } from '@/lib/api/sample';
import { buildEditorHtml, parseEditorMessage } from '@/lib/doc/editorHtml';
import { markdownToHtml } from '@/lib/doc/markdown';

test('the page is entirely self-contained — no remote anything', () => {
  const html = buildEditorHtml(markdownToHtml(SAMPLE_MARKDOWN), true);
  expect(html).not.toMatch(/https?:\/\//);
  expect(html).not.toMatch(/<link\b/i);
  expect(html).not.toMatch(/src\s*=/i);
  expect(html).not.toMatch(/@import/i);
  expect(html).not.toMatch(/fetch\(|XMLHttpRequest/);
});

test('the document is injected as data, not spliced into markup', () => {
  // A manuscript containing markup must not be able to break the page open.
  const nasty = '# A </div><script>alert(1)</script> heading\n\nAnd *prose*.\n';
  const html = buildEditorHtml(markdownToHtml(nasty), true);
  expect(html).not.toContain('<script>alert(1)</script>');
  expect(html).toContain('&lt;script&gt;');
  // Exactly one script element: ours.
  expect(html.match(/<script/g)).toHaveLength(1);
});

test('the toolbar labels the formats in words', () => {
  const html = buildEditorHtml('<p>x</p>', true);
  for (const label of ['Bold', 'Italic', 'Title', 'Heading', 'Body']) {
    expect(html).toContain(`>${label}<`);
  }
});

test('a read-only editor hides its toolbar and its contenteditable', () => {
  const html = buildEditorHtml('<p>x</p>', false);
  expect(html).toContain('contenteditable="false"');
  expect(html).toMatch(/#toolbar\s*\{[^}]*display:\s*none/);
});

test('bridge messages are parsed defensively', () => {
  expect(parseEditorMessage(JSON.stringify({ type: 'change', html: '<p>a</p>' }))).toEqual({
    type: 'change',
    html: '<p>a</p>',
  });
  expect(parseEditorMessage(JSON.stringify({ type: 'ready', html: '' }))?.type).toBe('ready');
  expect(parseEditorMessage('not json')).toBeNull();
  expect(parseEditorMessage(JSON.stringify({ type: 'something-else' }))).toBeNull();
  expect(parseEditorMessage('null')).toBeNull();
});

// --- keyboard dismissal + caret stability -----------------------------------

test('the page offers a Done button whenever the keyboard is up', () => {
  const html = buildEditorHtml('<p>x</p>', true);
  expect(html).toContain('id="done"');
  // The rail — and therefore the way out — appears on focus, not on selection.
  // Requiring a selection to dismiss the keyboard would be a trap with extra steps.
  expect(html).toContain('#bar {\n    display: none;');
  expect(html).toContain('body.focused #bar { display: flex; }');
  expect(html).toMatch(/doc\.addEventListener\('focus'/);
  expect(html).toMatch(/doc\.addEventListener\('blur'/);
});

test('formatting chrome is absent until text is actually selected', () => {
  const html = buildEditorHtml('<p>x</p>', true);
  // Default state on the most important screen is the manuscript and nothing
  // else — no permanent Bold/Italic furniture above someone's novel.
  expect(html).toContain('#toolbar {\n    display: none;');
  expect(html).toContain('body.selecting #toolbar { display: flex; }');
  // And "selected" means a real, non-collapsed range inside the document.
  expect(html).toContain('!sel.isCollapsed');
  expect(html).toContain("classList.toggle('selecting', on)");
});

test('the app can blur the document across the bridge', () => {
  expect(buildEditorHtml('<p>x</p>', true)).toContain('window.__blur');
});

test('viewport scroll never moves the caret — only a resize does', () => {
  const html = buildEditorHtml('<p>x</p>', true);
  // The scroll listener gets fitToViewport ALONE. Pairing it with
  // keepCaretVisible is the page scrolling back while the writer's finger is
  // still dragging, which reads as the editor fighting them.
  expect(html).toContain("addEventListener('scroll', fitToViewport)");
  expect(html).toMatch(/addEventListener\('resize', function \(\) \{\s*fitToViewport\(\);\s*keepCaretVisible\(\);/);
});

test('layout-forcing work is coalesced to one pass per frame', () => {
  const html = buildEditorHtml('<p>x</p>', true);
  // Caret rescue and toolbar state both read layout; per-keystroke they are the
  // measure/write/measure cycle that makes typing feel heavy.
  expect(html).toContain('caretPending');
  expect(html).toContain('toolbarPending');
  expect(html).toMatch(/requestAnimationFrame/);
  // And the viewport height is only written when it actually changed.
  expect(html).toContain('if (h === lastHeight) return;');
});

test('the inline script actually parses', () => {
  // The page is a string we assemble by hand. A syntax error in it does not fail
  // typecheck, lint, or the bundle — it produces a WebView that renders the
  // document and silently does nothing, which is indistinguishable from working.
  // `new Function` compiles without executing, so this catches it here.
  const html = buildEditorHtml('<p>Hello <strong>world</strong></p>', true);
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  expect(script).toBeTruthy();
  expect(() => new Function(script as string)).not.toThrow();
});
