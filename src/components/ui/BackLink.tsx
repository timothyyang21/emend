import { Pressable, View } from 'react-native';

import { space } from '@/theme/tokens';

import { AppText } from './AppText';

/**
 * The back control, top-left, on every screen above the manuscript.
 *
 * One shape everywhere so it is muscle memory rather than a scavenger hunt at
 * the bottom of a scrolling page — you should never have to scroll to leave.
 *
 * It names its destination. A bare chevron is a guess, and after two hops a
 * guess is usually wrong; that is also why callers pass an explicit target
 * rather than relying on router.back().
 */
export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Back to ${label}`}
        hitSlop={12}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xs,
          paddingVertical: space.xs,
          paddingRight: space.md,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <AppText variant="label">‹</AppText>
        <AppText variant="label">{label.toUpperCase()}</AppText>
      </Pressable>
    </View>
  );
}
