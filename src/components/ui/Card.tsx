import { PropsWithChildren } from 'react';
import { Pressable, View, ViewStyle } from 'react-native';

import { colors, radius, shadow, space } from '@/theme/tokens';

type Props = PropsWithChildren<{ onPress?: () => void; style?: ViewStyle }>;

export function Card({ children, onPress, style }: Props) {
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.sm,
    // Soft and warm rather than a hard grey drop — on ivory, a heavy shadow
    // reads as grime. This is most of what makes the cards feel light.
    ...shadow.card,
  };
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}
