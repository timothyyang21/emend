import { TextStyle } from 'react-native';

/** Design tokens — the single source of truth for the UI kit. Dark, modern, calm. */
export const colors = {
  bg: '#0B0B0F',
  surface: '#16161D',
  surfaceAlt: '#1E1E28',
  text: '#F5F5F7',
  textMuted: '#9A9AA8',
  border: '#2A2A36',
  primary: '#6C8CFF',
  primaryText: '#0B0B0F',
  danger: '#FF6B6B',
  success: '#4ADE80',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/**
 * RN does not synthesize weights for custom fonts — each weight is its own family.
 * Plain strings on purpose: tokens must not import the font packages.
 */
export const fontFamily = {
  sans: 'Figtree_400Regular',
  sansSemi: 'Figtree_600SemiBold',
  sansBold: 'Figtree_700Bold',
  prose: 'Literata_400Regular',
} as const;

export const typography: Record<'h1' | 'h2' | 'body' | 'label' | 'muted' | 'prose', TextStyle> = {
  h1: { fontSize: 28, fontFamily: fontFamily.sansBold, color: colors.text },
  h2: { fontSize: 22, fontFamily: fontFamily.sansSemi, color: colors.text },
  body: { fontSize: 16, fontFamily: fontFamily.sans, color: colors.text },
  label: { fontSize: 13, fontFamily: fontFamily.sansSemi, color: colors.textMuted },
  muted: { fontSize: 14, fontFamily: fontFamily.sans, color: colors.textMuted },
  prose: { fontSize: 17, fontFamily: fontFamily.prose, color: colors.text, lineHeight: 26 },
};

export const tokens = { colors, space, radius, typography, fontFamily };
