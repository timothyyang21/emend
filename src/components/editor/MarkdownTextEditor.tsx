/**
 * The plain editor: a multiline TextInput straight over the markdown.
 *
 * It is the web build's editor (react-native-webview has no web implementation),
 * and it is the escape hatch if the rich editor ever misbehaves on a device —
 * same props, same contract, so swapping them is a one-line change.
 *
 * Nothing here can corrupt anything: the markdown is the value, verbatim.
 */
import { type RefObject, useEffect, useRef } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { tokens } from '@/components/ui';
import type { MarkdownEditorProps } from '@/types/contracts';

export function MarkdownTextEditor({
  markdown,
  onChangeMarkdown,
  editable = true,
  onReady,
  inputRef,
  onFocus,
  onBlur,
}: MarkdownEditorProps & {
  inputRef?: RefObject<TextInput | null>;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const announced = useRef(false);
  useEffect(() => {
    if (announced.current) return;
    announced.current = true;
    onReady?.();
  }, [onReady]);

  return (
    <TextInput
      ref={inputRef}
      onFocus={onFocus}
      onBlur={onBlur}
      value={markdown}
      onChangeText={onChangeMarkdown}
      editable={editable}
      multiline
      textAlignVertical="top"
      scrollEnabled
      autoCorrect
      spellCheck
      selectionColor={tokens.colors.primary}
      style={styles.input}
      accessibilityLabel="Manuscript"
    />
  );
}

const styles = StyleSheet.create({
  input: {
    // `prose` is the reading face from the type scale — the same one AppText
    // uses for manuscript text, so the editor and the diff view match.
    ...tokens.typography.prose,
    flex: 1,
    padding: tokens.space.lg,
    backgroundColor: tokens.colors.bg,
  },
});
