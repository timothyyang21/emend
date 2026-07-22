/**
 * What the screen can ask the editor to do.
 *
 * Only blur, deliberately. The document itself flows through props — an
 * imperative setter would give the app a second way to change the manuscript,
 * and two paths to the same state is how they drift.
 */
export type MarkdownEditorHandle = {
  /** Put the keyboard away. Safe to call when already blurred. */
  blur: () => void;
};
