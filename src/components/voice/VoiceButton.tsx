import { Pressable, View } from 'react-native';

import { AppText, Icon, tokens } from '@/components/ui';

/**
 * The voice control — a quiet circle carrying the icon's rose, resting
 * bottom-right over the manuscript.
 *
 * ONE GESTURE: tap to start, tap again to stop. The happy path never opens a
 * panel — the button is the whole control, and it says what it is doing.
 *
 * There was briefly a hold-to-speak path as well. It came out: a press-and-hold
 * that starts recording is easy to trigger by accident while scrolling a
 * manuscript, and it was never verified on a device. Two gestures on one control
 * is also two ways to end up in a state the writer did not choose. One tested
 * path beats two, one of which is a guess.
 *
 * Purely presentational — every piece of voice state is owned above it.
 */
const SIZE = 64;

export function VoiceButton({
  onPress,
  recording,
  durationSec,
  disabled,
}: {
  onPress: () => void;
  recording?: boolean;
  /** Shown while recording, so the button itself is proof it is hearing you. */
  durationSec?: number;
  disabled?: boolean;
}) {
  return (
    <View style={{ alignItems: 'center', gap: tokens.space.xs }}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Stop recording' : 'Edit by voice'}
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
          transform: [{ scale: pressed ? 0.96 : 1 }],
          opacity: disabled ? 0.5 : 1,
          ...tokens.shadow.card,
        })}
      >
        <Icon name={recording ? 'stop' : 'rose'} size={28} color="#FFFFFF" />
      </Pressable>
      {/* The mark alone would be a guess. One instruction underneath, always. */}
      <AppText variant="label">
        {recording ? `TAP TO SEND · ${(durationSec ?? 0).toFixed(1)}S` : 'TAP TO SPEAK'}
      </AppText>
    </View>
  );
}
