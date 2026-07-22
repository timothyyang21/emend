import { beforeEach, expect, test } from '@jest/globals';

import { SEED_TERMS, hasTerm, normaliseTerm, useDictionary } from '@/store/dictionary';

beforeEach(() => {
  useDictionary.setState({ terms: [...SEED_TERMS] });
});

test('seeded from the sample passage so it demonstrates itself', () => {
  expect(useDictionary.getState().terms).toEqual(['Thomas', 'Susan', 'Janet', 'Maple', 'Vine', 'New York']);
});

test('terms are normalised, never stored raw', () => {
  expect(normaliseTerm('  Aeryn   Kestrelle ')).toBe('Aeryn Kestrelle');
  useDictionary.getState().add('  Wyckhampe  ');
  expect(useDictionary.getState().terms).toContain('Wyckhampe');
});

test('duplicates are rejected case-insensitively', () => {
  // "susan" beside "Susan" would hand the model two spellings of one name and
  // ask it to preserve both.
  const before = useDictionary.getState().terms.length;
  useDictionary.getState().add('susan');
  useDictionary.getState().add('SUSAN');
  expect(useDictionary.getState().terms).toHaveLength(before);
  expect(hasTerm(['Susan'], 'sUsAn')).toBe(true);
});

test('empty input never becomes a term', () => {
  const before = useDictionary.getState().terms.length;
  useDictionary.getState().add('   ');
  useDictionary.getState().add('');
  expect(useDictionary.getState().terms).toHaveLength(before);
});

test('removing is exact and leaves the rest alone', () => {
  useDictionary.getState().remove('Susan');
  expect(useDictionary.getState().terms).not.toContain('Susan');
  expect(useDictionary.getState().terms).toContain('Thomas');
});
