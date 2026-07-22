import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { tally, tallySentence } from '@/store/proposal';
import { emendDiff } from '@/theme/emend';
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
  onDiscard,
  applying,
}: {
  proposal: EditProposal;
  segments: DiffSegment[];
  decisions: Readonly<Record<ID, HunkDecision>>;
  onDecide: (hunkId: ID, decision: HunkDecision) => void;
  onDecideAll: (decision: HunkDecision) => void;
  onApply: () => void;
  onDiscard: () => void;
  applying?: boolean;
}) {
  const [focusedId, setFocusedId] = useState<ID | null>(null);
  const t = tally(
    proposal.hunks.map((h) => h.id),
    decisions
  );

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <AppText variant="label">YOU SAID</AppText>
        <AppText variant="prose">“{proposal.instruction}”</AppText>
      </Card>

      <Card>
        <AppText variant="label">CHANGES</AppText>
        <AppText variant="h2">{tallySentence(t)}</AppText>
        {t.total > 1 && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              title="Accept all"
              size="sm"
              variant="secondary"
              onPress={() => onDecideAll('accepted')}
              style={{ flex: 1 }}
            />
            <Button
              title="Reject all"
              size="sm"
              variant="secondary"
              onPress={() => onDecideAll('rejected')}
              style={{ flex: 1 }}
            />
          </View>
        )}
      </Card>

      <Card style={{ backgroundColor: '#FBF7F0' }}>
        <AppText variant="label">YOUR MANUSCRIPT, WITH THE CHANGES</AppText>
        {/* Bounded so the change list below stays reachable on a phone. */}
        <ScrollView style={{ maxHeight: 320 }} nestedScrollEnabled>
          <DiffText
            segments={segments}
            decisions={decisions}
            focusedId={focusedId}
            onFocusHunk={setFocusedId}
          />
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 4 }}>
          <Legend color={emendDiff.deleteBg} label="coming out" />
          <Legend color={emendDiff.insertBg} label="going in" />
        </View>
      </Card>

      {proposal.hunks.map((h) => (
        <Card key={h.id} style={{ backgroundColor: '#FBF7F0' }}>
          <HunkRow
            hunk={h}
            decision={decisions[h.id] ?? 'pending'}
            focused={focusedId === h.id}
            onFocus={() => setFocusedId(h.id)}
            onDecide={(d) => onDecide(h.id, d)}
          />
        </Card>
      ))}

      <Card>
        <Button
          title={
            t.accepted === 0
              ? 'Nothing accepted yet'
              : `Apply ${t.accepted} change${t.accepted === 1 ? '' : 's'}`
          }
          onPress={onApply}
          disabled={t.accepted === 0 || applying}
          loading={applying}
        />
        {t.pending > 0 && t.accepted > 0 && (
          <AppText variant="muted">
            {t.pending} change{t.pending === 1 ? '' : 's'} you haven&apos;t decided on will be left
            as they were.
          </AppText>
        )}
        <Button title="Discard this edit" variant="ghost" onPress={onDiscard} disabled={applying} />
      </Card>
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
