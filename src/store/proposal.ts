import { create } from 'zustand';

import type { EditProposal, HunkDecision, ID } from '@/types/contracts';

/**
 * The review session: one proposal, and what the writer has said about each of
 * its hunks. Integrator-owned — this is the spine of the product.
 *
 * NOT persisted, deliberately. A half-reviewed proposal restored from disk days
 * later would be a set of decisions about a document that has since moved on,
 * and applying them would corrupt the manuscript. A proposal lives and dies with
 * the session that created it.
 *
 * Note what is NOT in here: the document text. The doc store owns that. This
 * store only ever hands back a string for the doc store to accept — it never
 * writes to the manuscript itself.
 */

/** Where the writer is in the loop. Each value is rendered in words. */
export type ReviewPhase =
  | 'idle' // no proposal — just the manuscript
  | 'thinking' // waiting on the model
  | 'reviewing' // a proposal is on screen, being decided
  | 'error';

export const REVIEW_PHASE_LABEL: Record<ReviewPhase, string> = {
  idle: 'Ready',
  thinking: 'Reading your manuscript…',
  reviewing: 'Review the changes',
  error: 'That edit did not go through',
};

export interface ProposalState {
  phase: ReviewPhase;
  proposal: EditProposal | null;
  /** hunk id → decision. Absent means 'pending'. */
  decisions: Record<ID, HunkDecision>;
  /**
   * What we heard, shown back verbatim while the model works and if it fails.
   * The writer needs to see that we understood them even when the edit doesn't
   * land — otherwise a failure is indistinguishable from a mis-hearing.
   */
  pendingInstruction: string | null;
  error: string | null;

  begin: (instruction: string) => void;
  present: (proposal: EditProposal) => void;
  fail: (message: string) => void;
  decide: (hunkId: ID, decision: HunkDecision) => void;
  decideAll: (decision: HunkDecision) => void;
  /** Leave review without touching the manuscript. */
  discard: () => void;
}

export const useProposal = create<ProposalState>((set, get) => ({
  phase: 'idle',
  proposal: null,
  decisions: {},
  pendingInstruction: null,
  error: null,

  begin: (instruction) =>
    set({
      phase: 'thinking',
      error: null,
      pendingInstruction: instruction,
      // Clear the previous proposal immediately. Leaving stale hunks on screen
      // under a "thinking" label invites deciding on the wrong document.
      proposal: null,
      decisions: {},
    }),

  present: (proposal) =>
    set({
      phase: 'reviewing',
      proposal,
      // Everything starts pending. Silence is not consent.
      decisions: {},
      error: null,
    }),

  fail: (message) => set({ phase: 'error', error: message, proposal: null, decisions: {} }),

  decide: (hunkId, decision) =>
    set((s) => ({ decisions: { ...s.decisions, [hunkId]: decision } })),

  decideAll: (decision) => {
    const { proposal } = get();
    if (!proposal) return;
    const next: Record<ID, HunkDecision> = {};
    for (const h of proposal.hunks) next[h.id] = decision;
    set({ decisions: next });
  },

  discard: () =>
    set({ phase: 'idle', proposal: null, decisions: {}, error: null, pendingInstruction: null }),
}));

// --- Derived helpers (pure, so they are testable without the store) ---------

export interface ReviewTally {
  total: number;
  accepted: number;
  rejected: number;
  pending: number;
}

export function tally(
  hunkIds: readonly ID[],
  decisions: Readonly<Record<ID, HunkDecision>>
): ReviewTally {
  let accepted = 0;
  let rejected = 0;
  for (const id of hunkIds) {
    const d = decisions[id] ?? 'pending';
    if (d === 'accepted') accepted++;
    else if (d === 'rejected') rejected++;
  }
  return {
    total: hunkIds.length,
    accepted,
    rejected,
    pending: hunkIds.length - accepted - rejected,
  };
}

/** The sentence shown above the diff. Words, not a progress bar. */
export function tallySentence(t: ReviewTally): string {
  if (t.total === 0) return 'No changes proposed.';
  const parts: string[] = [`${t.total} change${t.total === 1 ? '' : 's'}`];
  if (t.accepted) parts.push(`${t.accepted} accepted`);
  if (t.rejected) parts.push(`${t.rejected} rejected`);
  if (t.pending) parts.push(`${t.pending} still to decide`);
  return parts.join(' · ');
}
