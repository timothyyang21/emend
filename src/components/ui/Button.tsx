import { ActivityIndicator, Pressable, Text, ViewStyle } from 'react-native';

import { colors, fontFamily, radius, space } from '@/theme/tokens';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', size = 'md', loading, disabled, style }: Props) {
  const bg = variant === 'primary' ? colors.primary : variant === 'secondary' ? colors.surfaceAlt : 'transparent';
  const fg = variant === 'primary' ? colors.primaryText : colors.text;
  const pad = size === 'sm' ? space.sm : space.md;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          paddingVertical: pad,
          paddingHorizontal: space.lg,
          borderRadius: radius.md,
          alignItems: 'center',
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderColor: colors.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontFamily: fontFamily.sansSemi, fontSize: size === 'sm' ? 14 : 16 }}>{title}</Text>
      )}
    </Pressable>
  );
}
