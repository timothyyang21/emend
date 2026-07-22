import { Pressable, View } from 'react-native';

import { AppText, Icon, tokens } from '@/components/ui';

/**
 * The floating voice control — a quiet circle carrying the icon's rose, resting
 * bottom-right over the manuscript.
 *
 * WHY IT IS TWO STATES AND NOT A PERMANENT PANEL: the editor belongs to the
 * writer's words. An always-open command bar is a second thing competing for the
 * bottom of the screen while they are trying to write a sentence. Idle it is one
 * circle; tapping it opens the speaking affordance, and closing it puts the
 * screen back to prose.
 *
 * Purely presentational — every piece of voice state is owned above it.
 */
const SIZE = 62;

export function VoiceButton({
  onPress,
  disabled,
  active,
}: {
  onPress: () => void;
  /** True while the panel is open, so the control reads as the way back. */
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={{ alignItems: 'center', gap: tokens.space.xs }}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={active ? 'Close voice editing' : 'Edit by voice'}
        hitSlop={8}
        style={({ pressed }) => ({
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? tokens.colors.surfaceAlt : tokens.colors.primary,
          borderWidth: 1,
          borderColor: active ? tokens.colors.border : tokens.colors.primary,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          ...tokens.shadow.card,
        })}
      >
        <Icon
          name={active ? 'close' : 'rose'}
          size={26}
          color={active ? 'textMuted' : 'primaryText'}
        />
      </Pressable>
      {/* The mark alone would be a guess. One word underneath, always. */}
      <AppText variant="label">{active ? 'CLOSE' : 'SPEAK'}</AppText>
    </View>
  );
}
