/**
 * The diff engine — the trust surface of the product.
 *
 *   computeHunks(base, revised)               → reviewable changes
 *   layoutDiff(base, hunks)                   → base sliced for rendering
 *   applyDecisions(base, hunks, decisions)    → the document the writer agreed to
 *
 * Pure functions, no UI, no state. Implements the signatures frozen in
 * '@/types/contracts'.
 */
export { computeHunks } from './computeHunks';
export { layoutDiff } from './layoutDiff';
export { applyDecisions } from './applyDecisions';
