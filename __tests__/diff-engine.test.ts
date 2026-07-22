import { test, expect } from '@jest/globals';

import { SAMPLE_MARKDOWN } from '@/lib/api/sample';
import { applyDecisions, computeHunks, layoutDiff } from '@/lib/diff';
import type { Hunk, HunkDecision, ID } from '@/types/contracts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const decideAll = (hunks: Hunk[], decision: HunkDecision): Record<ID, HunkDecision> =>
  Object.fromEntries(hunks.map((h) => [h.id, decision]));

/**
 * Every structural promise the renderer and applyDecisions depend on. Called by
 * every test below, because a hunk list that violates any of these is not
 * "slightly wrong" — it silently corrupts a manuscript.
 */
function expectStructurallySound(base: string, hunks: Hunk[]) {
  const ids = new Set<string>();
  let previousEnd = 0;

  for (const h of hunks) {
    // 3. before is EXACTLY the base slice
    expect(h.before).toBe(base.slice(h.start, h.end));
    expect(h.start).toBeLessThanOrEqual(h.end);
    expect(h.end).toBeLessThanOrEqual(base.length);
    // 3. sorted, and never overlapping
    expect(h.start).toBeGreaterThanOrEqual(previousEnd);
    previousEnd = h.end;
    // ids unique within one diff
    expect(ids.has(h.id)).toBe(false);
    ids.add(h.id);
    // a hunk that changes nothing is not a decision worth asking for
    expect(h.before).not.toBe(h.after);
    // kind agrees with the payload
    if (h.before === '') expect(h.kind).toBe('insert');
    else if (h.after === '') expect(h.kind).toBe('delete');
    else expect(h.kind).toBe('replace');
    // 2. a pure insertion is zero-width
    if (h.kind === 'insert') expect(h.start).toBe(h.end);
  }
}

/** The round trip that IS the product. */
function expectRoundTrips(base: string, revised: string): Hunk[] {
  const hunks = computeHunks(base, revised);
  expectStructurallySound(base, hunks);
  expect(applyDecisions(base, hunks, decideAll(hunks, 'accepted'))).toBe(revised);
  expect(applyDecisions(base, hunks, decideAll(hunks, 'rejected'))).toBe(base);
  expect(applyDecisions(base, hunks, decideAll(hunks, 'pending'))).toBe(base);
  // Silence is not consent: no decisions at all must also leave the base alone.
  expect(applyDecisions(base, hunks, {})).toBe(base);
  // layoutDiff must reassemble the base exactly.
  const reassembled = layoutDiff(base, hunks)
    .map((s) => (s.kind === 'equal' ? s.text : s.hunk.before))
    .join('');
  expect(reassembled).toBe(base);
  return hunks;
}

// ---------------------------------------------------------------------------
// Round trips
// ---------------------------------------------------------------------------

test('accept-all reproduces revised and reject-all reproduces base', () => {
  expectRoundTrips('one two three four', 'one 2 three 4');
  expectRoundTrips(SAMPLE_MARKDOWN, SAMPLE_MARKDOWN.replace(/Susan(?!nah)/g, 'Janet'));
  expectRoundTrips('The rain had stopped by four.', 'The storm had broken by four, at last.');
});

test('mixed accept/reject produces the exact expected string', () => {
  const base = 'one two three four';
  const revised = 'one 2 three 4';
  const hunks = expectRoundTrips(base, revised);
  expect(hunks).toHaveLength(2);

  expect(applyDecisions(base, hunks, { [hunks[0].id]: 'accepted' })).toBe('one 2 three four');
  expect(applyDecisions(base, hunks, { [hunks[1].id]: 'accepted' })).toBe('one two three 4');
  expect(
    applyDecisions(base, hunks, { [hunks[0].id]: 'accepted', [hunks[1].id]: 'rejected' })
  ).toBe('one 2 three four');
  // pending on one, accepted on the other — pending must behave exactly like rejected
  expect(
    applyDecisions(base, hunks, { [hunks[0].id]: 'pending', [hunks[1].id]: 'accepted' })
  ).toBe('one two three 4');
});

test('a decision keyed to an unknown id changes nothing', () => {
  const base = 'one two three four';
  const hunks = computeHunks(base, 'one 2 three 4');
  expect(applyDecisions(base, hunks, { 'not-a-hunk': 'accepted' })).toBe(base);
});

// ---------------------------------------------------------------------------
// Granularity: a substitution is ONE decision
// ---------------------------------------------------------------------------

test('a substitution is one replace hunk, not an adjacent delete and insert', () => {
  const hunks = expectRoundTrips('the cat sat on the mat', 'the dog sat on the mat');
  expect(hunks).toHaveLength(1);
  expect(hunks[0]).toMatchObject({ kind: 'replace', before: 'cat', after: 'dog' });
});

test('a mid-word change widens to the whole word instead of shredding', () => {
  // Raw diff-match-patch output here is "rec | delete i | insert e | ... " —
  // unreviewable. One word-level hunk is the only readable form.
  const hunks = expectRoundTrips('I recieve the letter', 'I receive the letter');
  expect(hunks).toHaveLength(1);
  expect(hunks[0]).toMatchObject({ kind: 'replace', before: 'recieve', after: 'receive' });
});

test('a change that is mid-word only in the REVISED text still widens', () => {
  // Clean boundary in the base, mid-word in the revision. Without checking both
  // sides this reviews as "insert the letter c", which means nothing.
  const hunks = expectRoundTrips('the at sat', 'the cat sat');
  expect(hunks).toHaveLength(1);
  expect(hunks[0]).toMatchObject({ before: 'at', after: 'cat' });
});

// ---------------------------------------------------------------------------
// The near-substring rename trap
// ---------------------------------------------------------------------------

test('a global rename skips near-substrings and stays one hunk per occurrence', () => {
  // A local fixture, not the seed document: this test is about the near-substring
  // trap specifically, and tying it to whatever prose the app happens to ship
  // means a copy change silently deletes the coverage.
  const base = [
    'Susan walked out along the terrace while the light was still good.',
    '',
    "She had not expected the house to be so quiet. Susan's aunt had written of company.",
    '',
    'At the far end stood Susannah Vane — her cousin, and no relation she had ever',
    'been glad of.',
    '',
    '"You are wanted," she said. "Susan\'s things have been moved to the east wing."',
    '',
  ].join('\n');

  // Only the standalone name (and its possessive) is renamed; "Susannah" is a
  // different character and must survive untouched.
  const revised = base.replace(/Susan(?!nah)/g, 'Janet');
  expect(revised).toContain('Susannah Vane');

  const hunks = expectRoundTrips(base, revised);

  // Three occurrences of the standalone name → three decisions.
  expect(hunks).toHaveLength(3);
  for (const h of hunks) {
    expect(h).toMatchObject({ kind: 'replace', before: 'Susan', after: 'Janet' });
    // Nothing collapsed into a giant hunk spanning paragraphs.
    expect(h.end - h.start).toBeLessThan(16);
  }

  // No hunk may sit inside "Susannah".
  const susannah = base.indexOf('Susannah');
  for (const h of hunks) {
    const overlapsSusannah = h.start < susannah + 'Susannah'.length && h.end > susannah;
    expect(overlapsSusannah).toBe(false);
  }

  // Accepting everything renames the three and leaves the cousin alone.
  const applied = applyDecisions(base, hunks, decideAll(hunks, 'accepted'));
  expect(applied).toContain('Susannah Vane');
  expect(applied).not.toMatch(/Susan(?!nah)/);
  expect(applied.match(/Janet/g)).toHaveLength(3);
});

test('multiple occurrences are independently decidable', () => {
  const base = 'Susan rose. Susan waited. Susan left.';
  const revised = 'Janet rose. Janet waited. Janet left.';
  const hunks = expectRoundTrips(base, revised);
  expect(hunks).toHaveLength(3);

  expect(applyDecisions(base, hunks, { [hunks[1].id]: 'accepted' })).toBe(
    'Susan rose. Janet waited. Susan left.'
  );
  expect(
    applyDecisions(base, hunks, { [hunks[0].id]: 'accepted', [hunks[2].id]: 'accepted' })
  ).toBe('Janet rose. Susan waited. Janet left.');
});

// ---------------------------------------------------------------------------
// Degenerate shapes
// ---------------------------------------------------------------------------

test('pure insertion at the start, middle and end of the document', () => {
  const cases: [string, string, string][] = [
    ['one two three', 'zero one two three', 'zero '],
    ['one two three', 'one two and a half three', 'and a half '],
    ['one two three', 'one two three four', ' four'],
  ];
  for (const [base, revised, after] of cases) {
    const hunks = expectRoundTrips(base, revised);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].kind).toBe('insert');
    expect(hunks[0].start).toBe(hunks[0].end);
    expect(hunks[0].before).toBe('');
    expect(hunks[0].after).toBe(after);
  }
});

test('pure deletion leaves after empty', () => {
  const hunks = expectRoundTrips('one two three', 'one three');
  expect(hunks).toHaveLength(1);
  expect(hunks[0].kind).toBe('delete');
  expect(hunks[0].after).toBe('');
  expect(hunks[0].before).toBe('two ');
});

test('no change yields zero hunks and applyDecisions is the identity', () => {
  const hunks = computeHunks(SAMPLE_MARKDOWN, SAMPLE_MARKDOWN);
  expect(hunks).toEqual([]);
  expect(applyDecisions(SAMPLE_MARKDOWN, hunks, {})).toBe(SAMPLE_MARKDOWN);
  expect(layoutDiff(SAMPLE_MARKDOWN, hunks)).toEqual([
    { kind: 'equal', text: SAMPLE_MARKDOWN },
  ]);
});

test('empty base, empty revised, and both empty', () => {
  const fromNothing = expectRoundTrips('', 'hello world');
  expect(fromNothing).toHaveLength(1);
  expect(fromNothing[0]).toMatchObject({ kind: 'insert', start: 0, end: 0, before: '' });

  const toNothing = expectRoundTrips('hello world', '');
  expect(toNothing).toHaveLength(1);
  expect(toNothing[0]).toMatchObject({ kind: 'delete', start: 0, end: 11, after: '' });

  expect(computeHunks('', '')).toEqual([]);
  expect(applyDecisions('', [], {})).toBe('');
  expect(layoutDiff('', [])).toEqual([]);
});

// ---------------------------------------------------------------------------
// Unicode
// ---------------------------------------------------------------------------

test('curly quotes, dashes and accents survive with correct offsets', () => {
  const base = 'She said “it’s fine” — really. Naïve café, non?';
  const revised = 'She said “it’s awful” — really. Naïve café, non?';
  const hunks = expectRoundTrips(base, revised);
  expect(hunks).toHaveLength(1);
  expect(hunks[0].before).toBe('fine');
  expect(base.slice(hunks[0].start, hunks[0].end)).toBe('fine');
  // The curly quote before the change is still a single character in the output.
  expect(applyDecisions(base, hunks, decideAll(hunks, 'accepted'))).toContain('“it’s awful”');
});

test('astral characters are never cut in half', () => {
  const base = 'a \u{1F389} b';
  const revised = 'a \u{1F388} b';
  const hunks = expectRoundTrips(base, revised);
  expect(hunks).toHaveLength(1);
  // Offsets are UTF-16 code units, so the pair is two units wide — and both of
  // them belong to the hunk.
  expect(hunks[0].end - hunks[0].start).toBe(2);
  expect([...hunks[0].before]).toHaveLength(1);
  expect([...hunks[0].after]).toHaveLength(1);
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

test('ids are deterministic across runs and derived from content, not index', () => {
  const base = SAMPLE_MARKDOWN;
  const revised = base.replace(/Susan(?!nah)/g, 'Janet');

  const first = computeHunks(base, revised).map((h) => h.id);
  const second = computeHunks(base, revised).map((h) => h.id);
  expect(second).toEqual(first);

  // Same change, different offset → different id. (An index-based id would give
  // these the same key and move a writer's "reject" onto the wrong change.)
  const repeated = computeHunks('Susan rose. Susan left.', 'Janet rose. Janet left.');
  expect(repeated[0].id).not.toBe(repeated[1].id);
});

// ---------------------------------------------------------------------------
// layoutDiff
// ---------------------------------------------------------------------------

test('layoutDiff interleaves equal runs and hunks in document order', () => {
  const base = 'one two three four';
  const hunks = computeHunks(base, 'one 2 three 4');
  const segments = layoutDiff(base, hunks);

  expect(segments.map((s) => s.kind)).toEqual(['equal', 'hunk', 'equal', 'hunk']);
  expect(segments[0]).toEqual({ kind: 'equal', text: 'one ' });
  expect(segments[2]).toEqual({ kind: 'equal', text: ' three ' });
  // Every hunk is present, exactly once, in order.
  const laidOut = segments.flatMap((s) => (s.kind === 'hunk' ? [s.hunk.id] : []));
  expect(laidOut).toEqual(hunks.map((h) => h.id));
});

test('layoutDiff emits no zero-length equal segments', () => {
  const base = 'one two three';
  for (const revised of ['zero one two three', 'one two three four', 'xxx']) {
    const segments = layoutDiff(base, computeHunks(base, revised));
    for (const segment of segments) {
      if (segment.kind === 'equal') expect(segment.text.length).toBeGreaterThan(0);
    }
  }
});

// ---------------------------------------------------------------------------
// A realistic manuscript edit
// ---------------------------------------------------------------------------

test('a multi-paragraph markdown edit stays a small, plausible number of hunks', () => {
  const base = SAMPLE_MARKDOWN;
  const revised = base
    .replace('was Thomas’s kingdom', 'had been Thomas’s kingdom')
    .replace("was Thomas's kingdom", "had been Thomas's kingdom")
    .replace('They were too full of her son.', 'They were too full of him.')
    .replace(
      'For a year, the forest stood silent and empty.',
      'For a year, the forest stood silent.'
    );

  // Guard the guard: if a copy edit to the seed makes these replacements no-op,
  // the test would "pass" against an unchanged document and prove nothing.
  expect(revised).not.toBe(base);

  const hunks = expectRoundTrips(base, revised);

  // Three edited passages. If cleanup were not working this would be dozens of
  // single-character hunks — the number is the test.
  expect(hunks.length).toBeGreaterThan(2);
  expect(hunks.length).toBeLessThanOrEqual(10);

  // And a whole-manuscript rename must not turn into 40 decisions. Two Susans
  // in the seed → two decisions.
  const renamed = computeHunks(base, base.replaceAll('Susan', 'Janet'));
  expect(renamed).toHaveLength(2);
  for (const h of renamed) {
    expect(h).toMatchObject({ before: 'Susan', after: 'Janet' });
  }
});

// ---------------------------------------------------------------------------
// Fuzz — the invariants have to hold for edits nobody thought of
// ---------------------------------------------------------------------------

test('randomised edits always round-trip and never violate the invariants', () => {
  // Seeded LCG: the same 200 cases every run, so a failure is reproducible.
  let seed = 0x2545f491;
  const rand = (n: number) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % n;
  };

  const words = SAMPLE_MARKDOWN.split(/(\s+)/);

  for (let i = 0; i < 200; i++) {
    const next = [...words];
    const edits = 1 + rand(6);
    for (let e = 0; e < edits; e++) {
      const at = rand(next.length);
      const roll = rand(3);
      if (roll === 0) next[at] = 'Janet';
      else if (roll === 1) next.splice(at, 1);
      else next.splice(at, 0, 'suddenly ');
    }
    const revised = next.join('');
    const hunks = computeHunks(SAMPLE_MARKDOWN, revised);
    expectStructurallySound(SAMPLE_MARKDOWN, hunks);
    expect(applyDecisions(SAMPLE_MARKDOWN, hunks, decideAll(hunks, 'accepted'))).toBe(revised);
    expect(applyDecisions(SAMPLE_MARKDOWN, hunks, decideAll(hunks, 'pending'))).toBe(
      SAMPLE_MARKDOWN
    );
    expect(
      layoutDiff(SAMPLE_MARKDOWN, hunks)
        .map((s) => (s.kind === 'equal' ? s.text : s.hunk.before))
        .join('')
    ).toBe(SAMPLE_MARKDOWN);
  }
});
