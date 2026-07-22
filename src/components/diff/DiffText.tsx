import { Pressable, Text, View } from 'react-native';

import { AppText } from '@/components/ui';
import { emendDiff } from '@/theme/emend';
import { fontFamily } from '@/theme/tokens';
import type { DiffSegment, Hunk, HunkDecision, ID } from '@/types/contracts';

/**
 * The manuscript with the proposed changes shown inline.
 *
 * Colours come from `@/theme/emend` rather than the current dark tokens on
 * purpose: the diff is the one surface where colour carries MEANING (rose =
 * going away, sage = coming in), so it ships in the product palette from the
 * start. The surrounding chrome catches up in the polish pass.
 *
 * Deliberately dumb — it takes segments and decisions and renders them. All diff
 * maths lives in `@/lib/diff`.
 */

const PROSE = { fontFamily: fontFamily.prose, fontSize: 17, lineHeight: 28 } as const;

type Props = {
  segments: DiffSegment[];
  decisions: Readonly<Record<ID, HunkDecision>>;
  /** Which hunk is currently being decided, if any. */
  focusedId?: ID | null;
  onFocusHunk?: (id: ID) => void;
};

export function DiffText({ segments, decisions, focusedId, onFocusHunk }: Props) {
  return (
    <View>
      <Text style={PROSE}>
        {segments.map((seg, i) => {
          if (seg.kind === 'equal') {
            return (
              <Text key={`eq-${i}`} style={[PROSE, { color: emendDiff.deleteText }]}>
                {seg.text}
              </Text>
            );
          }

          const { hunk } = seg;
          const decision = decisions[hunk.id] ?? 'pending';
          const focused = focusedId === hunk.id;

          // What the writer sees depends on what they have decided — and each
          // state shows only the text that state would actually produce, so the
          // page always reads as the document they are choosing.
          const showBefore = decision !== 'accepted' && hunk.before.length > 0;
          const showAfter = decision !== 'rejected' && hunk.after.length > 0;

          return (
            <Text key={hunk.id}>
              {showBefore && (
                <Text
                  onPress={onFocusHunk ? () => onFocusHunk(hunk.id) : undefined}
                  style={[
                    PROSE,
                    {
                      backgroundColor: emendDiff.deleteBg,
                      color: emendDiff.deleteText,
                      textDecorationLine: 'line-through',
                      textDecorationColor: emendDiff.deleteRule,
                    },
                    decision === 'rejected' && {
                      // Rejected: it stays, so it is no longer struck through.
                      backgroundColor: 'transparent',
                      textDecorationLine: 'none',
                    },
                    focused && { borderBottomWidth: 2, borderColor: emendDiff.focusRing },
                  ]}
                >
                  {hunk.before}
                </Text>
              )}
              {showAfter && (
                <Text
                  onPress={onFocusHunk ? () => onFocusHunk(hunk.id) : undefined}
                  style={[
                    PROSE,
                    { backgroundColor: emendDiff.insertBg, color: emendDiff.insertText },
                    focused && { borderBottomWidth: 2, borderColor: emendDiff.focusRing },
                  ]}
                >
                  {hunk.after}
                </Text>
              )}
            </Text>
          );
        })}
      </Text>
    </View>
  );
}

/**
 * One change, with its two controls. Accept and reject are SEPARATE, both
 * labelled in words, and both reversible — a decision you cannot take back is
 * the failure mode this whole product exists to avoid.
 */
export function HunkRow({
  hunk,
  decision,
  onDecide,
  focused,
  onFocus,
}: {
  hunk: Hunk;
  decision: HunkDecision;
  onDecide: (d: HunkDecision) => void;
  focused?: boolean;
  onFocus?: () => void;
}) {
  const stateWord =
    decision === 'accepted' ? 'Accepted' : decision === 'rejected' ? 'Rejected' : 'Not decided';

  return (
    <Pressable
      onPress={onFocus}
      style={{
        borderWidth: 1,
        borderColor: focused ? emendDiff.focusRing : 'transparent',
        borderRadius: 12,
        padding: 12,
        gap: 8,
      }}
    >
      <AppText variant="label">{stateWord.toUpperCase()}</AppText>

      {hunk.before.length > 0 && (
        <Text style={[PROSE, { backgroundColor: emendDiff.deleteBg, color: emendDiff.deleteText }]}>
          {hunk.before}
        </Text>
      )}
      {hunk.after.length > 0 && (
        <Text style={[PROSE, { backgroundColor: emendDiff.insertBg, color: emendDiff.insertText }]}>
          {hunk.after}
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <DecisionButton
          label="Accept"
          active={decision === 'accepted'}
          tint={emendDiff.insertBg}
          onPress={() => onDecide(decision === 'accepted' ? 'pending' : 'accepted')}
        />
        <DecisionButton
          label="Reject"
          active={decision === 'rejected'}
          tint={emendDiff.deleteBg}
          onPress={() => onDecide(decision === 'rejected' ? 'pending' : 'rejected')}
        />
      </View>
    </Pressable>
  );
}

/**
 * A toggle, not a commit: pressing the active one returns the hunk to
 * undecided. Every action here is reversible without destroying anything.
 */
function DecisionButton({
  label,
  active,
  tint,
  onPress,
}: {
  label: string;
  active: boolean;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        // Active state is a filled background, not a tick glyph — a 16px symbol
        // gets misread, a block of colour with a word on it does not.
        backgroundColor: active ? tint : 'transparent',
        borderWidth: 1,
        borderColor: active ? tint : emendDiff.deleteRule,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: fontFamily.sansSemi,
          fontSize: 14,
          color: active ? emendDiff.deleteText : emendDiff.deleteRule,
        }}
      >
        {active ? `${label}ed` : label}
      </Text>
    </Pressable>
  );
}
