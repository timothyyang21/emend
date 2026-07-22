import { test, expect, beforeEach } from '@jest/globals';

import { useWriting } from '@/store/writing';

beforeEach(() => useWriting.getState().clear());

test('upsert adds an entry, removeMany deletes it', () => {
  const id = useWriting.getState().upsert({ title: 'A', body: 'hello' });
  expect(useWriting.getState().entries).toHaveLength(1);
  expect(useWriting.getState().entries[0].title).toBe('A');
  useWriting.getState().removeMany([id]);
  expect(useWriting.getState().entries).toHaveLength(0);
});

test('bulk removeMany deletes several at once, keeping the rest', () => {
  const a = useWriting.getState().upsert({ title: 'A', body: '' });
  useWriting.getState().upsert({ title: 'B', body: '' });
  const c = useWriting.getState().upsert({ title: 'C', body: '' });
  useWriting.getState().removeMany([a, c]);
  const titles = useWriting.getState().entries.map((e) => e.title);
  expect(titles).toEqual(['B']);
});

test('upsert with an id updates in place', () => {
  const id = useWriting.getState().upsert({ title: 'A', body: 'x' });
  useWriting.getState().upsert({ id, title: 'A2', body: 'y' });
  expect(useWriting.getState().entries).toHaveLength(1);
  expect(useWriting.getState().entries[0].title).toBe('A2');
});
