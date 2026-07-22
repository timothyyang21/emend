/**
 * The editor, for the document screen.
 *
 * `MarkdownEditor` is the rich one on iOS/Android (WebView contenteditable) and
 * the plain one on web, chosen by Metro's platform extensions — the import site
 * never has to care. Both implement `MarkdownEditorProps` exactly, so
 * `MarkdownTextEditor` can also be swapped in deliberately if the rich editor
 * ever misbehaves on a device.
 *
 * Both need a bounded height: they fill their parent (`flex: 1`) and scroll
 * internally. Do not put either inside a ScrollView.
 */
export { MarkdownEditor } from './MarkdownEditor';
export { MarkdownTextEditor } from './MarkdownTextEditor';
