import { Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold } from '@expo-google-fonts/figtree';
import { Literata_400Regular } from '@expo-google-fonts/literata';
import { useFonts } from 'expo-font';
import { Platform } from 'react-native';

/**
 * True once the faces are ready OR loading has failed — callers render either way.
 * Failing open matters: a font asset that fails to resolve must not leave the app on a blank splash.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Figtree_400Regular,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Literata_400Regular,
  });

  // Web always renders. Expo pre-renders the full tree to static HTML, so gating
  // the first CLIENT render on font loading makes client and server disagree —
  // a hydration mismatch (React error #418) that throws away the prerender and
  // re-renders everything. There's no splash to hold on web anyway, and the faces
  // arrive via CSS @font-face regardless. Caught by scripts/check-web.sh.
  if (Platform.OS === 'web') return true;

  return loaded || error !== null;
}
