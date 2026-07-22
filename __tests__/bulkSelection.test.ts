import { test, expect } from '@jest/globals';

import {
  emptySelection, enter, exit, toggle, selectAll, clear, isSelected,
} from '@/lib/selection/bulkSelection';

test('toggle adds then removes an id and turns mode on', () => {
  let s = emptySelection();
  expect(s.mode).toBe(false);
  s = toggle(s, 'a');
  expect(s.mode).toBe(true);
  expect(isSelected(s, 'a')).toBe(true);
  s = toggle(s, 'a');
  expect(isSelected(s, 'a')).toBe(false);
});

test('selectAll selects exactly the given ids', () => {
  const s = selectAll(emptySelection(), ['a', 'b', 'c']);
  expect(Array.from(s.selected).sort()).toEqual(['a', 'b', 'c']);
});

test('clear empties selection but keeps mode; exit resets everything', () => {
  const s = toggle(enter(emptySelection()), 'a');
  const cleared = clear(s);
  expect(cleared.selected.size).toBe(0);
  expect(cleared.mode).toBe(true);
  const exited = exit();
  expect(exited.mode).toBe(false);
  expect(exited.selected.size).toBe(0);
});
