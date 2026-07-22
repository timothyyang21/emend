import { ActivityIndicator, View } from 'react-native';

import { AppText } from './AppText';
import { colors, space } from '@/theme/tokens';

export function Loading({ label }: { label?: string }) {
  return (
    <View style={{ padding: space.xl, alignItems: 'center', gap: space.sm }}>
      <ActivityIndicator color={colors.primary} />
      {label ? <AppText variant="muted">{label}</AppText> : null}
    </View>
  );
}
