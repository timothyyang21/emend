import { Text, TextProps } from 'react-native';

import { typography } from '@/theme/tokens';

type Variant = keyof typeof typography;

export function AppText({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <Text {...rest} style={[typography[variant], style]} />;
}
