/** Per-item entrance delay for a staggered list, capped so long lists don't crawl. */
export function staggerDelay(index: number, step: number, max = 300): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  if (!Number.isFinite(step) || step <= 0) return 0;
  return Math.min(index * step, max);
}
