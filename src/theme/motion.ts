import { useCallback, useEffect } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export { staggerDelay } from '@/lib/motion/stagger';

export const duration = { fast: 150, base: 250, slow: 400 } as const;
export const easing = Easing.out(Easing.cubic);
export const motion = { duration, easing };

/** Fade + rise on mount. Pass a stagger delay for list items. */
export function useFadeInUp(delayMs = 0) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(delayMs, withTiming(1, { duration: duration.base, easing }));
  }, [progress, delayMs]);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 12 }],
  }));
}

/** Scale down while pressed. Spread onPressIn/onPressOut onto a Pressable. */
export function usePressScale(scale = 0.97) {
  const pressed = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scale) }],
  }));

  const onPressIn = useCallback(() => {
    pressed.value = withTiming(1, { duration: duration.fast });
  }, [pressed]);

  const onPressOut = useCallback(() => {
    pressed.value = withSpring(0);
  }, [pressed]);

  return { style, onPressIn, onPressOut };
}
