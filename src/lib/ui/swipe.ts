/**
 * True when a left swipe has passed the delete threshold.
 *
 * The 'worklet' directive is required: this is called from a Reanimated gesture
 * callback running on the UI thread, and a plain JS function can't be called from
 * a worklet. It remains an ordinary function to Node, so it stays unit-testable.
 */
export function shouldDelete(translationX: number, threshold: number): boolean {
  'worklet';
  if (!Number.isFinite(translationX)) return false;
  return translationX <= -Math.abs(threshold);
}
