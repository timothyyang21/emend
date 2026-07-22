import { View } from 'react-native';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';
import { space } from '@/theme/tokens';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ padding: space.xl, alignItems: 'center', gap: space.sm }}>
      <Icon name="alert-circle-outline" size="lg" color="danger" />
      <AppText variant="muted" style={{ textAlign: 'center' }}>{message}</AppText>
      {onRetry ? <Button title="Try again" variant="secondary" size="sm" onPress={onRetry} /> : null}
    </View>
  );
}
