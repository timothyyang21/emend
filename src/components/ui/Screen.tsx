import { PropsWithChildren } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, space } from '@/theme/tokens';

type Props = PropsWithChildren<{
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  /** Lift content above the keyboard. */
  avoidKeyboard?: boolean;
  /** Tap outside an input to dismiss the keyboard. */
  dismissOnTap?: boolean;
}>;

export function Screen({ children, scroll, padded = true, style, avoidKeyboard, dismissOnTap }: Props) {
  const pad = padded ? space.lg : 0;

  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[{ padding: pad, gap: space.md }, style]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={dismissOnTap ? 'on-drag' : 'none'}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, padding: pad, gap: space.md }, style]}>{children}</View>
  );

  // Only the non-scroll branch gets the dismiss wrapper — a Pressable around this component's own ScrollView would break its scrolling.
  const content =
    dismissOnTap && !scroll ? (
      <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss} accessible={false}>
        {inner}
      </Pressable>
    ) : (
      inner
    );

  const body = avoidKeyboard ? (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {content}
    </KeyboardAvoidingView>
  ) : (
    content
  );

  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>{body}</SafeAreaView>;
}
