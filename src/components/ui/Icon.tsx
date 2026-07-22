import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/theme/tokens';

const SIZES = { sm: 16, md: 20, lg: 24 } as const;

export type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  name: IconName;
  size?: keyof typeof SIZES | number;
  color?: keyof typeof colors | (string & {});
};

export function Icon({ name, size = 'md', color = 'text' }: Props) {
  const px = typeof size === 'number' ? size : SIZES[size];
  const hex = (colors as Record<string, string>)[color as string] ?? (color as string);
  return <Ionicons name={name} size={px} color={hex} />;
}
