/**
 * Web build of the editor. react-native-webview has no web implementation, so
 * importing the WebView editor here would take the whole bundle down — and a
 * dead web bundle looks exactly like a working one (see CLAUDE.md).
 *
 * Same props, same contract, same imperative handle: the plain markdown editor
 * stands in. The handle is honoured rather than stubbed — a blur() that silently
 * did nothing on one platform is the kind of difference that only shows up in a
 * demo.
 */
import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { TextInput } from 'react-native';

import type { MarkdownEditorProps } from '@/types/contracts';

import { MarkdownTextEditor } from './MarkdownTextEditor';
import type { MarkdownEditorHandle } from './types';

export const MarkdownEditor = forwardRef<
  MarkdownEditorHandle,
  MarkdownEditorProps & { onFocusChange?: (focused: boolean) => void }
>(function MarkdownEditor({ onFocusChange, ...props }, ref) {
  const inputRef = useRef<TextInput>(null);
  useImperativeHandle(ref, () => ({ blur: () => inputRef.current?.blur() }));
  return (
    <MarkdownTextEditor
      {...props}
      inputRef={inputRef}
      onFocus={() => onFocusChange?.(true)}
      onBlur={() => onFocusChange?.(false)}
    />
  );
});
