/**
 * The round trip is the manuscript's safety. If markdown → editor → markdown is
 * not byte-stable, autosave fires on a document nobody touched and — far worse —
 * the diff shows the writer changes they never made.
 *
 * So these tests are almost all one assertion: the string came back identical.
 */
import { test, expect } from '@jest/globals';

import { SAMPLE_MARKDOWN } from '@/lib/api/sample';
import {
  htmlToMarkdown,
  markdownToHtml,
  normalizeMarkdown,
  parseHtml,
  parseMarkdown,
} from '@/lib/doc/markdown';

/** markdown → editor → markdown, the exact path a real document takes. */
const roundTrip = (md: string) => htmlToMarkdown(markdownToHtml(md));

const stable = (md: string) => expect(roundTrip(md)).toBe(md);

// --- the document we actually ship ------------------------------------------

test('the sample manuscript survives the round trip byte for byte', () => {
  stable(SAMPLE_MARKDOWN);
});

test('the sample manuscript is already normalised', () => {
  expect(normalizeMarkdown(SAMPLE_MARKDOWN)).toBe(SAMPLE_MARKDOWN);
});

test('the sample manuscript survives ten round trips unchanged', () => {
  let md = SAMPLE_MARKDOWN;
  for (let i = 0; i < 10; i++) md = roundTrip(md);
  expect(md).toBe(SAMPLE_MARKDOWN);
});

test('hard-wrapped paragraphs keep their line breaks', () => {
  // Rewrapping would make every paragraph in the document a phantom hunk.
  const md = 'One line here\nand a second line\nand a third.\n';
  stable(md);
  expect(markdownToHtml(md)).toContain('<br>');
});

// --- headings ---------------------------------------------------------------

test('headings round trip at every level', () => {
  for (let level = 1; level <= 6; level++) {
    stable(`${'#'.repeat(level)} A heading\n\nAnd a paragraph.\n`);
  }
  expect(markdownToHtml('## Two\n')).toBe('<h2>Two</h2>');
});

test('a hash that is not a heading stays literal text', () => {
  stable('#nothashtag is not a heading\n');
  stable('C# is a language, and #4 is a number\n');
});

test('a heading with emphasis in it round trips', () => {
  stable('# The *Long* Gallery\n');
});

// --- emphasis ---------------------------------------------------------------

test('bold and italic round trip', () => {
  stable('This is **bold** and this is *italic*.\n');
  expect(markdownToHtml('**b** and *i*\n')).toBe('<p><strong>b</strong> and <em>i</em></p>');
});

test('nested emphasis round trips', () => {
  stable('A **bold run with *italic* inside** it.\n');
  stable('***bold italic***\n');
  stable('*italic with **bold** inside*\n');
});

test('emphasis parses to the nesting you would expect', () => {
  const blocks = parseMarkdown('***x***\n');
  expect(blocks[0].kids).toEqual([{ t: 'strong', kids: [{ t: 'em', kids: [{ t: 'text', v: 'x' }] }] }]);
});

test('whitespace is hoisted outside emphasis markers, never trapped inside', () => {
  // `** bold **` is four literal asterisks, not bold — emitting it would be a
  // corruption that only shows up on the NEXT load.
  const md = htmlToMarkdown('<p>a<strong> bold </strong>b</p>');
  expect(md).toBe('a **bold** b\n');
  stable(md);
});

// --- markdown-significant characters that must stay literal -----------------

test('asterisks used as arithmetic or bullets stay literal', () => {
  stable('The answer is 2 * 3 * 4 and nothing else.\n');
  stable('A lone * asterisk.\n');
  stable('An unclosed **run of stars.\n');
  stable('Trailing star *\n');
});

test('underscores stay literal — snake_case is not italics', () => {
  stable('Call snake_case_name and __dunder__ and _emphasis_ verbatim.\n');
  expect(markdownToHtml('_x_\n')).toBe('<p>_x_</p>');
});

test('backticks, brackets, pipes and angle brackets stay literal', () => {
  stable('Use `code` and [a link](https://example.com) and | a pipe.\n');
  stable('An <angle> bracket and a & ampersand and a < less-than.\n');
  stable('A back\\slash and a "quote" and an ellipsis…\n');
});

test('html-significant characters are escaped and unescaped symmetrically', () => {
  const md = 'a < b & c > d, "quoted", it’s fine\n';
  expect(markdownToHtml(md)).toContain('&lt;');
  stable(md);
});

test('curly quotes, em dashes and accents survive', () => {
  stable('“He said — and she didn’t reply — that café Süß costs €5.”\n');
});

// --- normalisation is a fixed point ------------------------------------------

test('normalizeMarkdown is idempotent, and normalised text round trips exactly', () => {
  const messy = '#  Title\r\n\r\n\r\nA paragraph with trailing spaces   \n\n\n\nAnother.';
  const once = normalizeMarkdown(messy);
  expect(normalizeMarkdown(once)).toBe(once);
  expect(roundTrip(once)).toBe(once);
  expect(once).toBe('# Title\n\nA paragraph with trailing spaces\n\nAnother.\n');
});

test('an empty document stays empty rather than becoming a stray newline', () => {
  expect(normalizeMarkdown('')).toBe('');
  expect(normalizeMarkdown('   \n\n  \n')).toBe('');
  expect(htmlToMarkdown('')).toBe('');
  expect(htmlToMarkdown('<p></p><p><br></p>')).toBe('');
});

// --- what the contenteditable actually hands back ---------------------------

test('contenteditable divs, spans and nbsp are absorbed', () => {
  expect(htmlToMarkdown('<div>one</div><div>two</div>')).toBe('one\n\ntwo\n');
  expect(htmlToMarkdown('<p><span style="color:red">plain</span> text</p>')).toBe(
    'plain text\n'
  );
  expect(htmlToMarkdown('<p>two&nbsp;spaces</p>')).toBe('two spaces\n');
  expect(htmlToMarkdown('<p>&amp;&lt;&gt;&#39;</p>')).toBe("&<>'\n");
});

test('b and i are treated as strong and em', () => {
  expect(htmlToMarkdown('<p><b>bold</b> <i>italic</i></p>')).toBe('**bold** *italic*\n');
});

test('unsupported formatting loses its tag but never its text', () => {
  expect(htmlToMarkdown('<p><u>underlined</u> and <a href="#">linked</a></p>')).toBe(
    'underlined and linked\n'
  );
  expect(htmlToMarkdown('<ul><li>one</li><li>two</li></ul>')).toBe('one\n\ntwo\n');
});

test('a stray closing tag does not unwind the document', () => {
  expect(htmlToMarkdown('<p>fine</strong> still fine</p>')).toBe('fine still fine\n');
  expect(htmlToMarkdown('<p>a <strong>b</p>')).toBe('a **b**\n');
});

test('text outside any block tag is still kept', () => {
  expect(htmlToMarkdown('loose text')).toBe('loose text\n');
  expect(parseHtml('loose text')).toHaveLength(1);
});

test('an empty paragraph between two paragraphs is one blank line, not two', () => {
  // Pressing Enter twice is how a writer starts a new paragraph.
  expect(htmlToMarkdown('<p>a</p><p><br></p><p>b</p>')).toBe('a\n\nb\n');
});

test('a trailing break added by the browser does not accumulate newlines', () => {
  expect(htmlToMarkdown('<p>a<br></p>')).toBe('a\n');
  expect(htmlToMarkdown('<p>a<br><br></p>')).toBe('a\n');
});

// --- the whole point --------------------------------------------------------

test('a realistic editing session leaves everything it did not touch alone', () => {
  const edited = SAMPLE_MARKDOWN.replace(/Susan couldn't bear/, "Janet couldn't bear");
  // If a copy edit to the seed makes that replacement a no-op, this test would
  // "pass" against an untouched document and prove nothing.
  expect(edited).not.toBe(SAMPLE_MARKDOWN);

  const out = roundTrip(edited);
  expect(out).toBe(edited);
  // And the only difference from the original is the one the writer made.
  expect(out.split('\n').filter((l, i) => l !== SAMPLE_MARKDOWN.split('\n')[i])).toHaveLength(1);
});
