import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AppText, BackLink, Button, Card, ConfirmDialog, tokens } from '@/components/ui';
import { tally, tallySentence } from '@/store/proposal';
import type { DiffSegment, EditProposal, HunkDecision, ID } from '@/types/contracts';

import { DiffText, HunkRow } from './DiffText';

/**
 * The review surface — the product, essentially.
 *
 * Structure, top to bottom:
 *   1. what we heard, verbatim (so a mis-hearing is obvious immediately)
 *   2. how many changes and where they stand, in a sentence
 *   3. the manuscript with changes inline
 *   4. one row per change, each with its own labelled Accept / Reject
 *   5. the commit bar — explicit, counted, and separate from every other action
 *
 * Applying is the ONLY thing that touches the manuscript, it names exactly how
 * many changes it will make, and discarding is a separate control that never
 * writes. Destroy, flag and dismiss stay three different buttons.
 */
export function ProposalReview({
  proposal,
  segments,
  decisions,
  onDecide,
  onDecideAll,
  onApply,
  onApplyAll,
  onDiscard,
  applying,
}: {
  proposal: EditProposal;
  segments: DiffSegment[];
  decisions: Readonly<Record<ID, HunkDecision>>;
  onDecide: (hunkId: ID, decision: HunkDecision) => void;
  onDecideAll: (decision: HunkDecision) => void;
  onApply: () => void;
  /** Accept every change and commit, in one tap. */
  onApplyAll: () => void;
  onDiscard: () => void;
  applying?: boolean;
}) {
  const [focusedId, setFocusedId] = useState<ID | null>(null);
  /**
   * A proposed edit is work the writer has not seen anywhere else — once it is
   * gone they would have to speak the instruction again. So leaving asks first,
   * and both exits (Back and Discard) go through the same question rather than
   * one of them being quietly destructive.
   */
  const [confirming, setConfirming] = useState(false);
  const t = tally(
    proposal.hunks.map((h) => h.id),
    decisions
  );

  const anyDecided = t.accepted > 0 || t.rejected > 0;

  return (
    <View style={{ flex: 1 }}>
      <ConfirmDialog
        visible={confirming}
        title="Discard the proposed changes?"
        message="They won't be applied to your manuscript, and you'd have to ask for the edit again."
        cancelLabel="Keep reviewing"
        confirmLabel="Discard"
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onDiscard();
        }}
      />

      {/* Same shape as every other screen, and never leaves silently. */}
      <BackLink label="Chapter 4" onPress={() => setConfirming(true)} />

      <ScrollView
        contentContainerStyle={{ gap: tokens.space.md, paddingBottom: tokens.space.xxl }}
        showsVerticalScrollIndicator={false}
      >

      <Card>
        <AppText variant="label">YOU SAID</AppText>
        <AppText variant="prose">“{proposal.instruction}”</AppText>
      </Card>

      <Card>
        <AppText variant="label">CHANGES</AppText>
        <AppText variant="h2">{tallySentence(t)}</AppText>
      </Card>

      <Card>
        <AppText variant="label">YOUR MANUSCRIPT, WITH THE CHANGES</AppText>
        {/* Full height, not a bounded inner scroller: the page scrolls now, and
            a nested ScrollView inside it fights the outer one for the gesture. */}
        <DiffText
          segments={segments}
          decisions={decisions}
          focusedId={focusedId}
          onFocusHunk={setFocusedId}
        />
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 4 }}>
          <Legend color={tokens.diff.deleteBg} label="coming out" />
          <Legend color={tokens.diff.insertBg} label="going in" />
        </View>
      </Card>

      {/* Secondary to Apply, never removed: deciding change by change is the
          whole trust argument of this product. */}
      <AppText variant="label">DECIDE ONE AT A TIME</AppText>

      {proposal.hunks.map((h) => (
        <Card key={h.id}>
          <HunkRow
            hunk={h}
            decision={decisions[h.id] ?? 'pending'}
            focused={focusedId === h.id}
            onFocus={() => setFocusedId(h.id)}
            onDecide={(d) => onDecide(h.id, d)}
          />
        </Card>
      ))}

      </ScrollView>

      {/* Pinned. The commit action must never be something you scroll to find —
          on a long diff it was below every change in the list. */}
      <View
        style={{
          paddingTop: tokens.space.md,
          gap: tokens.space.sm,
          borderTopWidth: 1,
          borderTopColor: tokens.colors.border,
          backgroundColor: tokens.colors.bg,
        }}
      >
        <Button
          title={
            anyDecided
              ? t.accepted === 0
                ? 'Nothing accepted yet'
                : `Apply ${t.accepted} change${t.accepted === 1 ? '' : 's'}`
              : `Apply all ${t.total} change${t.total === 1 ? '' : 's'}`
          }
          onPress={anyDecided ? onApply : onApplyAll}
          disabled={(anyDecided && t.accepted === 0) || applying}
          loading={applying}
        />
        {anyDecided && t.pending > 0 && t.accepted > 0 && (
          <AppText variant="muted">
            {t.pending} you haven&apos;t decided on will be left as they were.
          </AppText>
        )}
        <Button
          title="Discard this edit"
          variant="ghost"
          size="sm"
          onPress={() => setConfirming(true)}
          disabled={applying}
        />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: color }} />
      <AppText variant="muted">{label}</AppText>
    </View>
  );
}
