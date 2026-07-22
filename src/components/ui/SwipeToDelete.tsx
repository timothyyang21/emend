import { PropsWithChildren, useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Icon } from './Icon';
import { shouldDelete } from '@/lib/ui/swipe';
import { duration } from '@/theme/motion';
import { colors, radius, space } from '@/theme/tokens';

type Props = PropsWithChildren<{ onDelete: () => void; threshold?: number }>;

/**
 * Wrap any row. Swipe left past the threshold to delete; otherwise it springs back.
 * Fires `onDelete` after the row animates out, and resets its position first so the
 * row is reusable if the caller keeps it mounted (e.g. a pending-delete + undo flow).
 */
export function SwipeToDelete({ children, onDelete, threshold = 96 }: Props) {
  const x = useSharedValue(0);

  // activeOffsetX means only deliberate horizontal movement activates the gesture,
  // so vertical list scrolling still wins.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-10, 10])
        .onUpdate((e) => {
          x.value = Math.min(0, e.translationX);
        })
        .onEnd((e, success) => {
          if (success && shouldDelete(e.translationX, threshold)) {
            x.value = withTiming(-600, { duration: duration.fast }, (finished) => {
              if (finished) {
                x.value = 0;
                runOnJS(onDelete)();
              }
            });
          } else {
            x.value = withSpring(0);
          }
        }),
    [onDelete, threshold, x],
  );

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={{ overflow: 'hidden' }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.danger,
          borderRadius: radius.lg,
          alignItems: 'flex-end',
          justifyContent: 'center',
          paddingRight: space.lg,
        }}
      >
        <Icon name="trash" color="primaryText" />
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}
