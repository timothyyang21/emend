import { expect, test } from '@jest/globals';

import { tally, tallySentence, useProposal } from '@/store/proposal';
import type { EditProposal, Hunk } from '@/types/contracts';

function hunk(id: string): Hunk {
  return { id, kind: 'replace', start: 0, end: 5, before: 'Susan', after: 'Janet' };
}

function proposal(ids: string[]): EditProposal {
  return {
    id: 'p1',
    instruction: 'change Susan to Janet',
    baseMarkdown: 'Susan',
    revisedMarkdown: 'Janet',
    hunks: ids.map(hunk),
    createdAt: 0,
  };
}

test('an undecided hunk counts as pending, never as accepted', () => {
  const t = tally(['a', 'b', 'c'], { a: 'accepted' });
  expect(t).toEqual({ total: 3, accepted: 1, rejected: 0, pending: 2 });
});

test('tally sentence names every non-zero state in words', () => {
  expect(tallySentence(tally(['a'], {}))).toBe('1 change · 1 still to decide');
  expect(tallySentence(tally(['a', 'b'], { a: 'accepted', b: 'rejected' }))).toBe(
    '2 changes · 1 accepted · 1 rejected'
  );
  expect(tallySentence(tally([], {}))).toBe('No changes proposed.');
});

test('presenting a proposal starts every hunk undecided', () => {
  useProposal.getState().present(proposal(['a', 'b']));
  const s = useProposal.getState();
  expect(s.phase).toBe('reviewing');
  expect(s.decisions).toEqual({});
  expect(tally(['a', 'b'], s.decisions).pending).toBe(2);
});

test('a decision is reversible back to pending', () => {
  useProposal.getState().present(proposal(['a']));
  useProposal.getState().decide('a', 'accepted');
  expect(useProposal.getState().decisions.a).toBe('accepted');
  useProposal.getState().decide('a', 'pending');
  expect(useProposal.getState().decisions.a).toBe('pending');
});

test('beginning a new edit clears the previous proposal immediately', () => {
  useProposal.getState().present(proposal(['a']));
  useProposal.getState().decide('a', 'accepted');
  useProposal.getState().begin('make it ominous');

  const s = useProposal.getState();
  // Stale hunks under a "thinking" label would let the writer decide on a
  // document that is no longer the one being edited.
  expect(s.proposal).toBeNull();
  expect(s.decisions).toEqual({});
  expect(s.pendingInstruction).toBe('make it ominous');
});

test('a failed edit keeps the instruction on screen but drops the proposal', () => {
  useProposal.getState().begin('make it ominous');
  useProposal.getState().fail('The server was unreachable.');

  const s = useProposal.getState();
  expect(s.phase).toBe('error');
  expect(s.error).toBe('The server was unreachable.');
  expect(s.proposal).toBeNull();
  // Without this the writer cannot tell a failure from a mis-hearing.
  expect(s.pendingInstruction).toBe('make it ominous');
});

test('discarding leaves no trace of the review', () => {
  useProposal.getState().present(proposal(['a']));
  useProposal.getState().decide('a', 'accepted');
  useProposal.getState().discard();

  expect(useProposal.getState()).toMatchObject({
    phase: 'idle',
    proposal: null,
    decisions: {},
    pendingInstruction: null,
    error: null,
  });
});
