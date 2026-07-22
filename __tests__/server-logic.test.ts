/**
 * Safety net for the server handlers. `api/` is excluded from tsconfig, so
 * `npm run verify` never sees it — these tests are the only automated check on
 * the pure logic the endpoints depend on.
 *
 * Covered: fence stripping (the model wraps output despite being told not to),
 * the junk-response guard (a truncated reply must never reach the diff engine),
 * and version-stack push/cap ordering.
 */
import { describe, expect, test } from '@jest/globals';

import { checkRevision, MIN_LENGTH_RATIO, stripCodeFence } from '../api/_lib/text';
import { MAX_VERSIONS, newestFirst, pushVersion, sanitizeStack } from '../api/_lib/versions';
import type { DocumentVersion } from '@/types/contracts';

const DOC = [
  '# The Long Gallery',
  '',
  'The rain had stopped by four, and Susan walked out along the terrace while the',
  'light was still good.',
  '',
  'She had not expected the house to be so quiet.',
].join('\n');

// ---------------------------------------------------------------------------
// stripCodeFence
// ---------------------------------------------------------------------------

describe('stripCodeFence', () => {
  test('leaves an unfenced document alone', () => {
    expect(stripCodeFence(DOC)).toBe(DOC);
  });

  test('strips a bare wrapper fence', () => {
    expect(stripCodeFence('```\n' + DOC + '\n```')).toBe(DOC);
  });

  test('strips a wrapper fence with a markdown language tag', () => {
    expect(stripCodeFence('```markdown\n' + DOC + '\n```')).toBe(DOC);
    expect(stripCodeFence('```md\n' + DOC + '\n```')).toBe(DOC);
    expect(stripCodeFence('```MARKDOWN\n' + DOC + '\n```')).toBe(DOC);
  });

  test('strips a tilde wrapper fence and tolerates surrounding blank lines', () => {
    expect(stripCodeFence('\n\n~~~markdown\n' + DOC + '\n~~~\n\n')).toBe(DOC);
  });

  test('leaves a document that legitimately CONTAINS a fenced code block', () => {
    const withCode = [
      '# Notes',
      '',
      'Run this:',
      '',
      '```js',
      "console.log('hi');",
      '```',
      '',
      'Then stop.',
    ].join('\n');
    expect(stripCodeFence(withCode)).toBe(withCode);
  });

  test('does not unwrap a document that OPENS with a real code block', () => {
    // First line is a fence, but ```js is not a wrapper tag — this is the
    // writer's own code, and unwrapping it would eat their closing ```.
    const opensWithCode = ['```js', "console.log('hi');", '```', '', 'Prose after.'].join('\n');
    expect(stripCodeFence(opensWithCode)).toBe(opensWithCode);
  });

  test('does not unwrap when the inner fences are unbalanced', () => {
    // Wrapper-looking first/last lines, but an odd fence count inside means the
    // "wrapper" is really part of the content.
    const tricky = ['```', 'intro', '```python', 'x = 1', '```', '', 'tail', '```'].join('\n');
    expect(stripCodeFence(tricky)).toBe(tricky);
  });

  test('unwraps a wrapper that contains a balanced inner code block', () => {
    const inner = ['# Notes', '', '```js', 'const a = 1;', '```', '', 'Done.'].join('\n');
    expect(stripCodeFence('```markdown\n' + inner + '\n```')).toBe(inner);
  });

  test('handles an empty reply without throwing', () => {
    expect(stripCodeFence('')).toBe('');
    expect(stripCodeFence('   \n  ')).toBe('');
    expect(stripCodeFence('```')).toBe('```');
  });
});

// ---------------------------------------------------------------------------
// checkRevision — the junk guard
// ---------------------------------------------------------------------------

describe('checkRevision', () => {
  test('accepts a normal revision and returns it de-fenced', () => {
    const revised = DOC.replace(/Susan/g, 'Janet');
    const out = checkRevision({
      original: DOC,
      revised: '```markdown\n' + revised + '\n```',
      instruction: "change Susan's name to Janet everywhere",
    });
    expect(out).toEqual({ ok: true, markdown: revised });
  });

  test("restores the original's trailing newline so it is not a phantom hunk", () => {
    const original = `${DOC}\n`;
    const out = checkRevision({
      original,
      revised: '```markdown\n' + DOC + '\n```',
      instruction: 'tidy the heading',
    });
    expect(out.ok && out.markdown.endsWith('\n')).toBe(true);
    expect(out.ok && out.markdown).toBe(original);
  });

  test('does not invent a trailing newline the original did not have', () => {
    const out = checkRevision({ original: DOC, revised: DOC, instruction: 'tidy the heading' });
    expect(out).toEqual({ ok: true, markdown: DOC });
  });

  test('rejects an empty reply', () => {
    const out = checkRevision({ original: DOC, revised: '   \n ', instruction: 'make it ominous' });
    expect(out.ok).toBe(false);
    expect(out.ok === false && out.reason).toMatch(/empty/i);
  });

  test('rejects a reply that lost most of the document', () => {
    const out = checkRevision({
      original: DOC,
      revised: 'Sure! Here is the revised text.',
      instruction: 'make the opening more ominous',
    });
    expect(out.ok).toBe(false);
    expect(out.ok === false && out.reason).toMatch(/not a deletion/);
  });

  test('accepts a short reply when the instruction WAS a deletion', () => {
    const out = checkRevision({
      original: DOC,
      revised: '# The Long Gallery',
      instruction: 'delete everything after the heading',
    });
    expect(out.ok).toBe(true);
  });

  test('accepts a short reply for other shrinking instructions', () => {
    for (const instruction of [
      'cut the second paragraph',
      'shorten this a lot',
      'condense it to a single line',
      'summarise the chapter',
      'remove all dialogue',
    ]) {
      const out = checkRevision({ original: DOC, revised: '# The Long Gallery', instruction });
      expect([instruction, out.ok]).toEqual([instruction, true]);
    }
  });

  test('the floor is exactly MIN_LENGTH_RATIO of the original', () => {
    const original = 'x'.repeat(1000);
    const justUnder = 'y'.repeat(Math.floor(1000 * MIN_LENGTH_RATIO) - 1);
    const justOver = 'y'.repeat(Math.ceil(1000 * MIN_LENGTH_RATIO) + 1);
    expect(checkRevision({ original, revised: justUnder, instruction: 'rephrase' }).ok).toBe(false);
    expect(checkRevision({ original, revised: justOver, instruction: 'rephrase' }).ok).toBe(true);
  });

  test('an empty original cannot trip the ratio check', () => {
    expect(checkRevision({ original: '', revised: 'hello', instruction: 'write something' }).ok).toBe(
      true
    );
  });
});

// ---------------------------------------------------------------------------
// version stack
// ---------------------------------------------------------------------------

function v(version: number): DocumentVersion {
  return { version, markdown: `doc v${version}`, createdAt: version * 1000, label: `edit ${version}` };
}

describe('version stack', () => {
  test('pushes newest first without mutating the input', () => {
    const stack = [v(2), v(1)];
    const next = pushVersion(stack, v(3));
    expect(next.map((e) => e.version)).toEqual([3, 2, 1]);
    expect(stack.map((e) => e.version)).toEqual([2, 1]);
  });

  test('caps at MAX_VERSIONS, dropping the oldest', () => {
    let stack: DocumentVersion[] = [];
    for (let i = 1; i <= MAX_VERSIONS + 10; i += 1) stack = pushVersion(stack, v(i));
    expect(stack).toHaveLength(MAX_VERSIONS);
    expect(stack[0].version).toBe(MAX_VERSIONS + 10);
    expect(stack[stack.length - 1].version).toBe(11);
  });

  test('honours an explicit cap', () => {
    let stack: DocumentVersion[] = [];
    for (let i = 1; i <= 5; i += 1) stack = pushVersion(stack, v(i), 3);
    expect(stack.map((e) => e.version)).toEqual([5, 4, 3]);
    expect(pushVersion(stack, v(6), 0)).toEqual([]);
  });

  test('carries the label and the previous timestamp through', () => {
    const [entry] = pushVersion([], { version: 7, markdown: 'old', createdAt: 42, label: 'undo me' });
    expect(entry).toEqual({ version: 7, markdown: 'old', createdAt: 42, label: 'undo me' });
  });

  test('newestFirst re-sorts a stack that arrived out of order', () => {
    expect(newestFirst([v(1), v(9), v(4)]).map((e) => e.version)).toEqual([9, 4, 1]);
  });

  test('sanitizeStack drops malformed records instead of throwing', () => {
    const raw = [v(3), null, { version: 'two' }, { version: 2, markdown: 'ok', createdAt: 1 }, 'nope'];
    expect(sanitizeStack(raw).map((e) => e.version)).toEqual([3, 2]);
    expect(sanitizeStack(undefined)).toEqual([]);
    expect(sanitizeStack({ versions: [] })).toEqual([]);
  });
});
