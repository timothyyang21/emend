import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAppFonts } from '@/theme/fonts';

// Keep the splash up while fonts load. Errors are ignored on purpose — a failure
// here must never block startup.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const ready = useAppFonts();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Hydration beacon for scripts/check-web.sh. Expo pre-renders static HTML, so a
  // web build whose bundle failed to parse looks IDENTICAL to a working one —
  // right text, right layout, zero interactivity. This attribute only appears if
  // a real React effect ran, which is the one thing prerendering can't fake.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-app-mounted', '1');
    }
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Dark glyphs: the page is ivory now, not near-black. */}
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
