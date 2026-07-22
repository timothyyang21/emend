import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

import { AppText, Icon, tokens } from '@/components/ui';

/**
 * The status medallion — the rose, always on screen, while the app is working.
 *
 * The jarring part was never the wording: it was that "Working out what you
 * said" and "Reading your manuscript…" replaced each other with nothing
 * constant between them, so each step read as a new screen rather than the same
 * request continuing. The rose stays put and breathes; only the words cross-fade
 * underneath it.
 *
 * The pulse is also honest — it means "still working", so a long edit does not
 * look like a frozen one.
 */
export function VoiceStatus({
  label,
  detail,
  busy,
  recording,
}: {
  label: string;
  detail?: string;
  /** Pulses while true. */
  busy?: boolean;
  recording?: boolean;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  // Breathe while working; rest otherwise.
  useEffect(() => {
    if (!busy && !recording) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [busy, recording, pulse]);

  // Cross-fade whenever the wording changes, so one step becomes the next
  // instead of snapping to it.
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [label, fade]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.md }}>
      <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
        {/* A soft halo rather than a spinner: spinners say "blocked", and this
            is the app thinking about prose, not a page failing to load. */}
        <Animated.View
          style={{
            position: 'absolute',
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: recording ? tokens.colors.rose : tokens.colors.primary,
            opacity: glow,
            transform: [{ scale }],
          }}
        />
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: recording ? tokens.colors.danger : tokens.colors.primary,
          }}
        >
          <Icon name="rose" size={22} color="#FFFFFF" />
        </View>
      </View>

      <Animated.View style={{ flex: 1, opacity: fade }}>
        <AppText variant="h2">{label}</AppText>
        {detail ? <AppText variant="muted">{detail}</AppText> : null}
      </Animated.View>
    </View>
  );
}
