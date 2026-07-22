import type { DocumentVersion } from '@/types/contracts';

/**
 * Reading the version stack.
 *
 * THE ONE THING TO UNDERSTAND: each entry holds the markdown as it was BEFORE
 * the edit named in its label. Verified against the running server:
 *
 *   current = v3  "P1 janet ominous"
 *   stack   v2    label "make the opening more ominous"  → "P1 janet"
 *           v1    label "change Susan to Janet"          → the original passage
 *
 * So restoring an entry undoes the edit written on it, which is why every label
 * in the UI reads "Undo <instruction>" rather than naming the state.
 */

/** Newest first, and only entries we can actually restore. */
export function restorable(versions: DocumentVersion[]): DocumentVersion[] {
  return [...versions]
    .filter((v) => typeof v.markdown === 'string')
    .sort((a, b) => b.version - a.version);
}

/** The edit that "Undo" would reverse, or null when there is nothing to undo. */
export function lastEdit(versions: DocumentVersion[]): DocumentVersion | null {
  return restorable(versions)[0] ?? null;
}

/**
 * What an entry's control says. Falls back to the timestamp when an edit was
 * made by typing rather than by voice — an unlabelled row still has to say what
 * tapping it does.
 */
export function describeEdit(version: DocumentVersion, now: number): string {
  const label = version.label?.trim();
  return label && label.length > 0 ? label : `the edit from ${relativeTime(version.createdAt, now)}`;
}

/** Short and human. Deliberately coarse: exact seconds are noise here. */
export function relativeTime(then: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * The label to save a restore under, so undoing an undo reads correctly and the
 * stack stays a plain-English list of what happened.
 */
export function restoreLabel(version: DocumentVersion, now: number): string {
  return `Undo ${describeEdit(version, now)}`;
}
