import { beforeEach, expect, test } from '@jest/globals';

import {
  SEED_ENTRIES,
  hasTerm,
  normaliseTerm,
  toPromptTerms,
  useDictionary,
} from '@/store/dictionary';

beforeEach(() => {
  useDictionary.setState({ entries: SEED_ENTRIES.map((e) => ({ ...e })) });
});

test('seeded from the sample passage, each entry saying what it is', () => {
  const entries = useDictionary.getState().entries;
  expect(entries.map((e) => e.term)).toEqual([
    'Thomas', 'Susan', 'Janet', 'Maple', 'Vine', 'New York',
  ]);
  // A bare list of names is a spelling checker. The descriptions are what make
  // it a dictionary — and what tell the model a street from a character.
  expect(entries.every((e) => (e.description ?? '').length > 0)).toBe(true);
});

test('descriptions ride along to the model, attached to their term', () => {
  const prompt = toPromptTerms([
    { term: 'Vine', description: 'A street.' },
    { term: 'Wyckhampe' },
  ]);
  expect(prompt).toEqual(['Vine — A street.', 'Wyckhampe']);
});

test('an empty description never becomes a dangling dash', () => {
  expect(toPromptTerms([{ term: 'Susan', description: '   ' }])).toEqual(['Susan']);
});

test('descriptions are editable in place', () => {
  useDictionary.getState().describe('Vine', 'A street, not a plant.');
  expect(useDictionary.getState().entries.find((e) => e.term === 'Vine')?.description).toBe(
    'A street, not a plant.'
  );
  // Clearing it removes the description rather than storing an empty string.
  useDictionary.getState().describe('Vine', '');
  expect(useDictionary.getState().entries.find((e) => e.term === 'Vine')?.description).toBeUndefined();
});

test('terms are normalised and duplicates rejected case-insensitively', () => {
  expect(normaliseTerm('  Aeryn   Kestrelle ')).toBe('Aeryn Kestrelle');
  const before = useDictionary.getState().entries.length;
  useDictionary.getState().add('susan');
  useDictionary.getState().add('  SUSAN  ');
  expect(useDictionary.getState().entries).toHaveLength(before);
  expect(hasTerm([{ term: 'Susan' }], 'sUsAn')).toBe(true);
});

test('empty input never becomes an entry', () => {
  const before = useDictionary.getState().entries.length;
  useDictionary.getState().add('   ');
  expect(useDictionary.getState().entries).toHaveLength(before);
});

test('removing is exact and leaves the rest alone', () => {
  useDictionary.getState().remove('Susan');
  expect(useDictionary.getState().entries.map((e) => e.term)).not.toContain('Susan');
  expect(useDictionary.getState().entries.map((e) => e.term)).toContain('Thomas');
});
