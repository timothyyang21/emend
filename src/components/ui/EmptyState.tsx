import { View } from 'react-native';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, IconName } from './Icon';
import { space } from '@/theme/tokens';

type Props = {
  icon?: IconName;
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon = 'document-text-outline', title, hint, actionLabel, onAction }: Props) {
  return (
    <View style={{ padding: space.xl, alignItems: 'center', gap: space.sm }}>
      <Icon name={icon} size="lg" color="textMuted" />
      <AppText variant="h2">{title}</AppText>
      {hint ? <AppText variant="muted" style={{ textAlign: 'center' }}>{hint}</AppText> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} variant="secondary" size="sm" onPress={onAction} />
      ) : null}
    </View>
  );
}
