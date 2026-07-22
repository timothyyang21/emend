import { expect, test } from '@jest/globals';

import { buildEditorHtml, parseEditorMessage } from '@/lib/doc/editorHtml';

/**
 * THE DATA-LOSS GUARD.
 *
 * Observed in the wild: a zero-length document reached the server from a device
 * and landed on the version stack (v5, len=0) — an autosave that blanked a
 * manuscript. The root cause was never fully reproduced; the guard ships anyway,
 * because "we could not reproduce it" is not a reason to leave a path that
 * deletes someone's novel.
 *
 * The rule is NOT "reject empty documents". A writer is allowed to select all
 * and delete. The rule is that emptying the manuscript requires the writer to
 * have done it — which is what `userEdited` carries.
 */

test('the page refuses to emit anything before it has finished loading', () => {
  const html = buildEditorHtml('<p>Hello</p>', true);
  // Emits before hydration are page noise, not edits. Dropping them at the
  // source is cheaper than trying to tell them apart on the far side.
  expect(html).toContain('if (!pageReady) return;');
  expect(html).toMatch(/pageReady = true;\s*post\(\{ type: 'ready'/);
});

test('every change carries whether the writer caused it', () => {
  const html = buildEditorHtml('<p>Hello</p>', true);
  expect(html).toContain("post({ type: 'change', html: doc.innerHTML, userEdited: userEdited })");
  // Typing, pasting and formatting are the writer. Nothing else is.
  expect(html.match(/userEdited = true;/g)).toHaveLength(3);
});

test('the app replacing the document resets the writer flag', () => {
  const html = buildEditorHtml('<p>Hello</p>', true);
  // Otherwise a stale `true` from an earlier keystroke would let a racy emit
  // borrow the writer's authority and empty the manuscript with it.
  expect(html).toMatch(/doc\.innerHTML = html;[\s\S]{0,220}userEdited = false;/);
});

test('a change message round-trips its provenance across the bridge', () => {
  const typed = parseEditorMessage(JSON.stringify({ type: 'change', html: '', userEdited: true }));
  expect(typed).toEqual({ type: 'change', html: '', userEdited: true });

  const racy = parseEditorMessage(JSON.stringify({ type: 'change', html: '', userEdited: false }));
  expect(racy).toEqual({ type: 'change', html: '', userEdited: false });
});

/**
 * The guard itself lives in MarkdownEditor.onMessage, which needs a WebView to
 * exercise. This is the decision table it implements, kept here so the rule is
 * readable without reading the component.
 */
test('the guard drops exactly one case: empty, over content, not by the writer', () => {
  const shouldDrop = (next: string, current: string, userEdited: boolean) =>
    next.trim().length === 0 && current.trim().length > 0 && !userEdited;

  // The bug: a racy empty emit over a real manuscript.
  expect(shouldDrop('', 'The forest behind their house…', false)).toBe(true);
  expect(shouldDrop('   \n  ', 'The forest behind their house…', false)).toBe(true);

  // A writer deliberately clearing their chapter is allowed. Blocking this would
  // be a different bug, and a more insulting one.
  expect(shouldDrop('', 'The forest behind their house…', true)).toBe(false);

  // Nothing else is affected: real edits, and an already-empty document.
  expect(shouldDrop('New words', 'The forest…', false)).toBe(false);
  expect(shouldDrop('', '', false)).toBe(false);
});
