import * as Clipboard from 'expo-clipboard';

/** Copy text. Resolves false rather than throwing, so callers can toast without a try/catch. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}
