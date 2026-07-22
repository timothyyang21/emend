/** Height for an auto-growing input: the measured content height, bounded by min/max. */
export function clampHeight(contentHeight: number, min: number, max: number): number {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) return min;
  return Math.min(Math.max(contentHeight, min), max);
}
