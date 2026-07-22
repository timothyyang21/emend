import { useRef } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Icon, tokens } from '@/components/ui';

/**
 * The voice control — a quiet circle carrying the icon's rose, resting
 * bottom-right over the manuscript.
 *
 * TWO GESTURES, ONE BUTTON, because writers differ and neither should have to
 * learn a panel first:
 *   hold  → record while held, release to send. Nothing else appears.
 *   tap   → start recording hands-free; the status strip takes over.
 *
 * A press only counts as a hold after HOLD_MS, so a slightly slow tap is still a
 * tap rather than a recording nobody meant to start.
 *
 * Purely presentational — every piece of voice state is owned above it.
 */
const SIZE = 64;
const HOLD_MS = 260;

export function VoiceButton({
  onTap,
  onHoldStart,
  onHoldEnd,
  recording,
  durationSec,
  disabled,
}: {
  onTap: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  recording?: boolean;
  /** Shown while recording — held speech has no panel, so proof of life lives here. */
  durationSec?: number;
  disabled?: boolean;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  function onPressIn() {
    held.current = false;
    timer.current = setTimeout(() => {
      held.current = true;
      onHoldStart();
    }, HOLD_MS);
  }

  function onPressOut() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (held.current) {
      held.current = false;
      onHoldEnd();
    } else {
      onTap();
    }
  }

  return (
    <View style={{ alignItems: 'center', gap: tokens.space.xs }}>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Edit by voice. Tap to start, or hold and speak."
        hitSlop={10}
        style={({ pressed }) => ({
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: recording ? tokens.colors.danger : tokens.colors.primary,
          borderWidth: recording ? 3 : 1,
          borderColor: recording ? tokens.colors.rose : tokens.colors.primary,
          // Grows while held, so the gesture is visibly doing something.
          transform: [{ scale: pressed || recording ? 1.06 : 1 }],
          opacity: disabled ? 0.5 : 1,
          ...tokens.shadow.card,
        })}
      >
        <Icon name={recording ? 'stop' : 'rose'} size={28} color="#FFFFFF" />
      </Pressable>
      {/* The mark alone would be a guess. One instruction underneath, always,
          and it changes to tell you how to finish what you started. */}
      <AppText variant="label">
        {recording
          ? `RELEASE TO SEND · ${(durationSec ?? 0).toFixed(1)}S`
          : 'HOLD TO SPEAK'}
      </AppText>
    </View>
  );
}
