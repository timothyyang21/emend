import { PropsWithChildren } from 'react';
import { Pressable, View, ViewStyle } from 'react-native';

import { colors, radius, space } from '@/theme/tokens';

type Props = PropsWithChildren<{ onPress?: () => void; style?: ViewStyle }>;

export function Card({ children, onPress, style }: Props) {
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.sm,
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
