import { Figtree_400Regular, Figtree_600SemiBold } from '@expo-google-fonts/figtree';
import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import { useFonts } from 'expo-font';
import { Platform } from 'react-native';

/**
 * Fraunces carries the prose and the headings — this is an app about writing, so
 * the writing should look like writing. Figtree is chrome only: labels, buttons,
 * counts. Literata is gone; two serif families would just be noise.
 *
 * True once the faces are ready OR loading has failed — callers render either way.
 * Failing open matters: a font asset that fails to resolve must not leave the app on a blank splash.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Figtree_400Regular,
    Figtree_600SemiBold,
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });

  // Web always renders. Expo pre-renders the full tree to static HTML, so gating
  // the first CLIENT render on font loading makes client and server disagree —
  // a hydration mismatch (React error #418) that throws away the prerender and
  // re-renders everything. There's no splash to hold on web anyway, and the faces
  // arrive via CSS @font-face regardless. Caught by scripts/check-web.sh.
  if (Platform.OS === 'web') return true;

  return loaded || error !== null;
}
