/**
 * Web build of the editor. react-native-webview has no web implementation, so
 * importing the WebView editor here would take the whole bundle down — and a
 * dead web bundle looks exactly like a working one (see CLAUDE.md).
 *
 * Same props, same contract: the plain markdown editor stands in.
 */
export { MarkdownTextEditor as MarkdownEditor } from './MarkdownTextEditor';
