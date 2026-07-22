import { Platform, Share } from 'react-native';

/** Share/export text — native share sheet, or web share/clipboard fallback. */
export async function shareText(text: string, title = 'Shared from the app'): Promise<void> {
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & {
      share?: (d: { title?: string; text?: string }) => Promise<void>;
    }) : undefined;
    if (nav?.share) {
      await nav.share({ title, text });
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return;
    }
    return;
  }
  await Share.share({ title, message: text });
}
