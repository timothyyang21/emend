/**
 * The rich-text editor: a WebView contenteditable, over MARKDOWN.
 *
 * Markdown stays the source of truth. The page holds HTML because that is what a
 * contenteditable is; every crossing of the bridge goes through the pure
 * converters in @/lib/doc/markdown, which are tested outside the browser. The
 * editor is a *view*, never the owner of a second representation.
 *
 * WHY THE ECHO GUARD MATTERS MORE THAN IT LOOKS. If we pushed the `markdown`
 * prop back into the page every render, every keystroke would rewrite the DOM
 * under the writer and throw the caret to the top of the document. So we track
 * the text the page currently holds and only push when the app's copy genuinely
 * diverges — a cold load, or accepted diff hunks.
 *
 * Requires only react-native-webview, which ships inside Expo Go: no dev build.
 * (Web has no WebView implementation — MarkdownEditor.web.tsx serves the plain
 * editor there, same props.)
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { AppText, tokens } from '@/components/ui';
import { buildEditorHtml, parseEditorMessage } from '@/lib/doc/editorHtml';
import { htmlToMarkdown, markdownToHtml } from '@/lib/doc/markdown';
import type { MarkdownEditorProps } from '@/types/contracts';

import { MarkdownTextEditor } from './MarkdownTextEditor';
import type { MarkdownEditorHandle } from './types';

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(props, ref) {
  // A WebView that fails to load is a manuscript the writer cannot touch. The
  // plain editor takes over — announced in words, because an editor that quietly
  // changed shape is worse than one that says why.
  const [failed, setFailed] = useState<string | null>(null);

  if (failed !== null) {
    return (
      <View style={styles.container}>
        <View style={styles.notice}>
          <AppText variant="label">PLAIN TEXT EDITING</AppText>
          <AppText variant="muted">{failed}</AppText>
        </View>
        <MarkdownTextEditor {...props} />
      </View>
    );
  }
    return <RichEditor {...props} onFail={setFailed} handleRef={ref} />;
  }
);

function RichEditor({
  markdown,
  onChangeMarkdown,
  editable = true,
  onReady,
  onFail,
  handleRef,
}: MarkdownEditorProps & {
  onFail: (message: string) => void;
  handleRef: React.ForwardedRef<MarkdownEditorHandle>;
}) {
  const webRef = useRef<WebView>(null);

  // Tapping anywhere outside the document has to put the keyboard away. The
  // page owns the contenteditable, so only it can blur — the app asks.
  useImperativeHandle(handleRef, () => ({
    blur: () => webRef.current?.injectJavaScript('window.__blur && window.__blur(); true;'),
  }));

  // The markdown the page is currently displaying. Both directions update it,
  // which is what makes the guard below symmetrical.
  const shown = useRef(markdown);
  const ready = useRef(false);
  const announced = useRef(false);

  // Captured once: changing `source` remounts the WebView and would blow away
  // the caret, the undo stack and the scroll position.
  const initialHtml = useRef(buildEditorHtml(markdownToHtml(markdown), editable));

  function pushToPage(md: string) {
    shown.current = md;
    const html = JSON.stringify(markdownToHtml(md));
    webRef.current?.injectJavaScript(`window.__setHtml(${html}); true;`);
  }

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const message = parseEditorMessage(event.nativeEvent.data);
      if (!message) return;

      if (message.type === 'error') {
        // Not silently swallowed: the page could not open the document, so hand
        // the writer an editor that certainly can.
        console.warn('[MarkdownEditor]', message.message);
        onFail(message.message);
        return;
      }

      if (message.type === 'focus' || message.type === 'blur') return;

      if (message.type === 'ready') {
        ready.current = true;
        // The page may have opened before the real document arrived.
        if (shown.current !== markdown) pushToPage(markdown);
        if (!announced.current) {
          announced.current = true;
          onReady?.();
        }
        return;
      }

      const next = htmlToMarkdown(message.html);
      if (next === shown.current) return; // nothing actually changed

      // THE DATA-LOSS GUARD.
      //
      // A zero-length document was observed reaching the server from a device
      // and landing on the version stack — an autosave that blanks someone's
      // manuscript. The page can produce an empty innerHTML during the
      // load/hydration race, and by the time it crosses the bridge it is
      // indistinguishable from a real edit.
      //
      // So: emptying the manuscript is allowed ONLY when the writer did it. A
      // deliberate select-all-and-delete carries userEdited; a racy re-render
      // does not. This drops the second and keeps the first, which is why it is
      // not simply "reject empty".
      if (next.trim().length === 0 && shown.current.trim().length > 0 && !message.userEdited) {
        console.warn('[MarkdownEditor] dropped an empty document that the writer did not type');
        return;
      }

      shown.current = next;
      onChangeMarkdown(next);
    },
    [markdown, onChangeMarkdown, onReady, onFail]
  );

  useEffect(() => {
    if (!ready.current) return; // the 'ready' handler covers the pre-load case
    if (markdown === shown.current) return; // our own echo — leave the caret alone
    pushToPage(markdown);
  }, [markdown]);

  useEffect(() => {
    if (!ready.current) return;
    webRef.current?.injectJavaScript(`window.__setEditable(${editable ? 'true' : 'false'}); true;`);
  }, [editable]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        source={{ html: initialHtml.current }}
        originWhitelist={['*']}
        onMessage={onMessage}
        // The page is a local string with no network in it; nothing should be
        // able to navigate it anywhere.
        javaScriptEnabled
        setSupportMultipleWindows={false}
        allowsLinkPreview={false}
        // The document scrolls INSIDE the page, so the caret-visibility logic in
        // the page is the only thing that has to be right.
        scrollEnabled={false}
        hideKeyboardAccessoryView
        keyboardDisplayRequiresUserAction={false}
        automaticallyAdjustContentInsets={false}
        onError={() => onFail('The rich editor could not start, so this is the markdown itself.')}
        onRenderProcessGone={() =>
          onFail('The rich editor stopped responding, so this is the markdown itself.')
        }
        onContentProcessDidTerminate={() =>
          onFail('The rich editor stopped responding, so this is the markdown itself.')
        }
        style={styles.web}
        containerStyle={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  web: { flex: 1, backgroundColor: tokens.colors.bg },
  notice: {
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    gap: tokens.space.xs,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
});
