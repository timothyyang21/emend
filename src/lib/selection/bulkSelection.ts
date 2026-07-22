import { useCallback, useState } from 'react';

export interface SelectionState {
  mode: boolean;
  selected: Set<string>;
}

export function emptySelection(): SelectionState {
  return { mode: false, selected: new Set() };
}

export function enter(s: SelectionState): SelectionState {
  return { mode: true, selected: new Set(s.selected) };
}

export function exit(): SelectionState {
  return emptySelection();
}

export function toggle(s: SelectionState, id: string): SelectionState {
  const selected = new Set(s.selected);
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  return { mode: true, selected };
}

export function selectAll(_s: SelectionState, ids: string[]): SelectionState {
  return { mode: true, selected: new Set(ids) };
}

export function clear(s: SelectionState): SelectionState {
  return { mode: s.mode, selected: new Set() };
}

export function isSelected(s: SelectionState, id: string): boolean {
  return s.selected.has(id);
}

export function useBulkSelection() {
  const [state, setState] = useState<SelectionState>(emptySelection);
  return {
    mode: state.mode,
    selectedIds: Array.from(state.selected),
    count: state.selected.size,
    isSelected: useCallback((id: string) => state.selected.has(id), [state]),
    toggle: useCallback((id: string) => setState((s) => toggle(s, id)), []),
    selectAll: useCallback((ids: string[]) => setState((s) => selectAll(s, ids)), []),
    clear: useCallback(() => setState((s) => clear(s)), []),
    enter: useCallback(() => setState((s) => enter(s)), []),
    exit: useCallback(() => setState(exit), []),
  };
}
