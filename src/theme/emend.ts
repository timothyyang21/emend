/**
 * EMEND ART DIRECTION — recorded now, APPLIED IN THE POLISH PASS.
 *
 * Nothing imports this file yet, and that is deliberate: the vertical slice runs
 * on the rig's existing dark `tokens.ts`. Swapping the look mid-slice would mean
 * debugging layout and voice at the same time. When the slice is green, the
 * polish pass rewires `@/theme/tokens` to re-export these values and the UI kit
 * picks them up in one move — see "Applying this" at the bottom.
 *
 * Vibe: spring-clear, light Regency. Literary, elegant, airy, restrained.
 */

import { TextStyle } from 'react-native';

// --- Palette ------------------------------------------------------------

export const emendColors = {
  /** Ivory/cream page. The whole app sits on this. */
  bg: '#FBF7F0',
  /** Cards and raised surfaces — a hair lighter than the page, not white. */
  surface: '#FFFDF9',
  /** Recessed / secondary fill. */
  surfaceAlt: '#F4EEE4',
  /** Deep ink. Body text and headings. */
  text: '#2B2620',
  /** Ink at ~60% — labels, timestamps, chrome. */
  textMuted: '#7A7168',
  /** Hairline. Warm, never grey. */
  border: '#E5DCCD',

  /** Champagne gold — the accent. Primary actions, focus, the mic. */
  primary: '#C9A66B',
  /** Ink on gold: gold is too light to carry white text legibly. */
  primaryText: '#2B2620',

  /** Soft blush-rose — removals, destructive intent. */
  rose: '#E8B7B0',
  /** Muted sage — additions, confirmation. */
  sage: '#A8B99A',

  danger: '#B4655C',
  success: '#6E8A5E',
} as const;

// --- Diff -------------------------------------------------------------
//
// The single most important colour decision in the app: this is the surface
// where the writer decides what happens to their prose. On-brand AND legible —
// the backgrounds are pale enough that deep-ink text keeps its contrast, so a
// deletion is never harder to read than the text around it.

export const emendDiff = {
  /** Deleted text sits on soft rose, struck through. */
  deleteBg: '#F6DCD8',
  deleteText: emendColors.text,
  /** Rose at full strength for the strike-through rule itself. */
  deleteRule: '#C98D84',

  /** Added text sits on sage. */
  insertBg: '#DDE7D2',
  insertText: emendColors.text,
  insertRule: '#7E9469',

  /** A hunk the writer is currently deciding on. */
  focusRing: emendColors.primary,
} as const;

// --- Type -------------------------------------------------------------
//
// High-contrast serif carries the prose and the headings — this is an app about
// writing, so the writing should look like writing. Sans is chrome only: labels,
// buttons, counts. Fraunces is the first choice (variable, high contrast, a
// touch of warmth); Cormorant and Playfair are the fallbacks if it reads too
// modern on device.

export const emendFontFamily = {
  prose: 'Fraunces_400Regular',
  proseItalic: 'Fraunces_400Regular_Italic',
  proseSemi: 'Fraunces_600SemiBold',
  display: 'Fraunces_700Bold',
  sans: 'Figtree_400Regular',
  sansSemi: 'Figtree_600SemiBold',
} as const;

export const emendTypography: Record<
  'display' | 'h1' | 'h2' | 'body' | 'label' | 'muted' | 'prose',
  TextStyle
> = {
  display: { fontSize: 34, fontFamily: emendFontFamily.display, color: emendColors.text, letterSpacing: -0.5 },
  h1: { fontSize: 26, fontFamily: emendFontFamily.display, color: emendColors.text },
  h2: { fontSize: 20, fontFamily: emendFontFamily.proseSemi, color: emendColors.text },
  body: { fontSize: 16, fontFamily: emendFontFamily.sans, color: emendColors.text },
  label: { fontSize: 12, fontFamily: emendFontFamily.sansSemi, color: emendColors.textMuted, letterSpacing: 0.6 },
  muted: { fontSize: 14, fontFamily: emendFontFamily.sans, color: emendColors.textMuted },
  /** The manuscript itself. Generous leading — this gets read, not scanned. */
  prose: { fontSize: 18, fontFamily: emendFontFamily.prose, color: emendColors.text, lineHeight: 30 },
};

// --- Shape & air ------------------------------------------------------
//
// Airier than the rig defaults across the board: whitespace is most of what
// makes this feel elegant rather than merely beige.

export const emendSpace = { xs: 4, sm: 8, md: 14, lg: 20, xl: 32, xxl: 48 } as const;
export const emendRadius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;

/** Soft, warm, barely-there. No hard grey drop shadows. */
export const emendShadow = {
  card: {
    shadowColor: '#2B2620',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
} as const;

/**
 * ONE botanical motif, used once — a corner sprig on the empty state or the
 * document header, never repeated as wallpaper. Recorded as intent; the asset
 * is not built yet.
 */
export const emendMotif = { budget: 1, placement: 'document header, top-right' } as const;

export const emendTheme = {
  colors: emendColors,
  diff: emendDiff,
  space: emendSpace,
  radius: emendRadius,
  shadow: emendShadow,
  typography: emendTypography,
  fontFamily: emendFontFamily,
} as const;

/**
 * APPLYING THIS (polish pass, one sitting):
 *
 *   1. npx expo install @expo-google-fonts/fraunces
 *   2. src/theme/fonts.ts — load Fraunces_400Regular / _600SemiBold / _700Bold
 *      alongside Figtree; drop Literata.
 *   3. src/theme/tokens.ts — re-export from here:
 *        export const colors = emendColors;  (etc.)
 *      The UI kit reads tokens only, so every primitive turns over at once.
 *   4. Check contrast on device in daylight — cream backgrounds lie on a
 *      simulator at full brightness.
 *
 * Until step 3 lands, the app is still dark. That is expected, not a bug.
 */
