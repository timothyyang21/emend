/**
 * Design tokens — the single source of truth for the UI kit.
 *
 * This file is now a thin re-export of the Emend art direction in ./emend.ts.
 * Every primitive in @/components/ui reads from here, so the whole app turned
 * over in one move rather than surface by surface. Keep the shape stable: the
 * key names below are the contract the UI kit compiles against.
 *
 * Spring-clear Regency: ivory page, deep ink, champagne gold. Light and airy.
 */
import {
  emendColors,
  emendDiff,
  emendFontFamily,
  emendRadius,
  emendShadow,
  emendSpace,
  emendTypography,
} from './emend';

export const colors = emendColors;
export const space = emendSpace;
export const radius = emendRadius;
export const shadow = emendShadow;

/** Rose/sage for the review surface. Re-exported so nothing imports two themes. */
export const diff = emendDiff;

/**
 * RN does not synthesize weights for custom fonts — each weight is its own family.
 * Plain strings on purpose: tokens must not import the font packages.
 */
export const fontFamily = {
  ...emendFontFamily,
  /** Kept for compatibility: the display face is the heaviest sans-ish we load. */
  sansBold: emendFontFamily.display,
} as const;

export const typography = emendTypography;

export const tokens = { colors, space, radius, shadow, diff, typography, fontFamily };
