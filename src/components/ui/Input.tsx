import { Text, TextInput, TextInputProps, View } from 'react-native';

import { colors, fontFamily, radius, space, typography } from '@/theme/tokens';

type Props = TextInputProps & { label?: string; error?: string };

export function Input({ label, error, style, ...rest }: Props) {
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Text style={typography.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...rest}
        style={[
          {
            backgroundColor: colors.surfaceAlt,
            color: colors.text,
            fontFamily: fontFamily.sans,
            borderRadius: radius.md,
            padding: space.md,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
          },
          style,
        ]}
      />
      {error ? (
        <Text style={{ color: colors.danger, fontSize: 12, fontFamily: fontFamily.sans }}>{error}</Text>
      ) : null}
    </View>
  );
}
