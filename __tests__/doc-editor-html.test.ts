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
