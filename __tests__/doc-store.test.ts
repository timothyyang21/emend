/**
 * The doc store's job is that the writer's manuscript is never lost and never
 * silently unsaved. These tests are about the four ways that promise breaks:
 * a burst of typing hammering the server, a slow save swallowing newer text,
 * a failure nobody is told about, and a cold start with no backend.
 *
 * The network is mocked — a test that can touch it is a test that can flake.
 */
import { test, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('@/lib/api', () => {
  const sample = jest.requireActual('@/lib/api/sample') as { SAMPLE_MARKDOWN: string };
  return {
    SAMPLE_MARKDOWN: sample.SAMPLE_MARKDOWN,
    apiBase: jest.fn(() => 'https://example.test'),
    apiConfigured: jest.fn(() => true),
    getDocument: jest.fn(),
    putDocument: jest.fn(),
    getVersions: jest.fn(),
    requestEdit: jest.fn(),
  };
});

import { SAMPLE_MARKDOWN } from '@/lib/api/sample';
import type { DocumentSnapshot, PutDocumentRequest } from '@/types/contracts';

type Api = {
  apiConfigured: jest.Mock<() => boolean>;
  getDocument: jest.Mock<() => Promise<DocumentSnapshot>>;
  putDocument: jest.Mock<(body: PutDocumentRequest) => Promise<DocumentSnapshot>>;
};

const snapshot = (markdown: string, version = 1): DocumentSnapshot => ({
  id: 'default',
  markdown,
  version,
  updatedAt: 1_700_000_000_000 + version,
});

/**
 * A fresh module registry per test: the store is a singleton with a debounce
 * timer inside it, so reusing it across tests leaks pending saves between them.
 */
function freshStore() {
  jest.resetModules();
  const api = jest.requireMock('@/lib/api') as Api;
  api.apiConfigured.mockReturnValue(true);
  api.getDocument.mockReset();
  api.putDocument.mockReset();
  const { useDoc } = jest.requireActual('@/store/doc') as typeof import('@/store/doc');
  return { useDoc, api };
}

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

// --- debounce ---------------------------------------------------------------

test('a burst of edits coalesces into one save of the last text', async () => {
  const { useDoc, api } = freshStore();
  api.putDocument.mockImplementation(async (body) =>
    snapshot(body.markdown)
  );

  useDoc.getState().setMarkdown('one');
  useDoc.getState().setMarkdown('one two');
  useDoc.getState().setMarkdown('one two three');

  expect(api.putDocument).not.toHaveBeenCalled();
  expect(useDoc.getState().status).toBe('saving');

  await jest.advanceTimersByTimeAsync(800);

  expect(api.putDocument).toHaveBeenCalledTimes(1);
  expect(api.putDocument.mock.calls[0][0]).toMatchObject({ markdown: 'one two three' });
  expect(useDoc.getState().status).toBe('idle');
  expect(useDoc.getState().version).toBe(1);
  expect(useDoc.getState().lastSyncedAt).not.toBeNull();
});

test('setMarkdown with identical text schedules nothing', async () => {
  const { useDoc, api } = freshStore();
  api.putDocument.mockImplementation(async (body) =>
    snapshot(body.markdown)
  );

  useDoc.getState().setMarkdown(useDoc.getState().markdown);
  await jest.advanceTimersByTimeAsync(800);

  expect(api.putDocument).not.toHaveBeenCalled();
  expect(useDoc.getState().status).toBe('idle');
});

test('flush saves immediately without waiting out the debounce', async () => {
  const { useDoc, api } = freshStore();
  api.putDocument.mockImplementation(async (body) =>
    snapshot(body.markdown)
  );

  useDoc.getState().setMarkdown('typed then closed the app');
  await useDoc.getState().flush();

  expect(api.putDocument).toHaveBeenCalledTimes(1);
  expect(api.putDocument.mock.calls[0][0]).toMatchObject({
    markdown: 'typed then closed the app',
  });
  expect(useDoc.getState().status).toBe('idle');
});

test('the label reaches the server with the save', async () => {
  const { useDoc, api } = freshStore();
  api.putDocument.mockImplementation(async (body) =>
    snapshot(body.markdown)
  );

  useDoc.getState().setMarkdown('revised', 'change Susan to Janet');
  await useDoc.getState().flush();

  expect(api.putDocument.mock.calls[0][0]).toMatchObject({
    label: 'change Susan to Janet',
  });
});

// --- the in-flight trap -----------------------------------------------------

test('edits arriving during an in-flight save are not lost, and the latest wins', async () => {
  const { useDoc, api } = freshStore();

  let releaseFirst: (v: DocumentSnapshot) => void = () => {};
  api.putDocument
    .mockImplementationOnce(
      () =>
        new Promise<DocumentSnapshot>((resolve) => {
          releaseFirst = resolve;
        })
    )
    .mockImplementation(async (body) => snapshot(body.markdown, 2));

  useDoc.getState().setMarkdown('first');
  await jest.advanceTimersByTimeAsync(800);
  expect(api.putDocument).toHaveBeenCalledTimes(1); // in flight, unresolved

  // Two more edits land while the network call is still open.
  useDoc.getState().setMarkdown('second');
  useDoc.getState().setMarkdown('third');
  await jest.advanceTimersByTimeAsync(800);

  // No competing write started — saves are serialised.
  expect(api.putDocument).toHaveBeenCalledTimes(1);

  releaseFirst(snapshot('first', 1));
  await useDoc.getState().flush();

  // Exactly two writes: the superseded 'second' was never worth sending, and
  // the newest text is what ended up stored.
  expect(api.putDocument).toHaveBeenCalledTimes(2);
  expect(api.putDocument.mock.calls[1][0]).toMatchObject({ markdown: 'third' });
  expect(useDoc.getState().markdown).toBe('third');
  expect(useDoc.getState().status).toBe('idle');
  expect(useDoc.getState().version).toBe(2);
});

test('a stale save response never overwrites newer local text', async () => {
  const { useDoc, api } = freshStore();

  let releaseFirst: (v: DocumentSnapshot) => void = () => {};
  api.putDocument
    .mockImplementationOnce(
      () =>
        new Promise<DocumentSnapshot>((resolve) => {
          releaseFirst = resolve;
        })
    )
    .mockImplementation(async (body) => snapshot(body.markdown, 2));

  useDoc.getState().setMarkdown('first');
  await jest.advanceTimersByTimeAsync(800);
  useDoc.getState().setMarkdown('newer text the writer can see');

  // The server echoes the OLD text back. Adopting it would yank words out from
  // under the writer mid-sentence.
  releaseFirst(snapshot('first', 1));
  await jest.advanceTimersByTimeAsync(0);
  expect(useDoc.getState().markdown).toBe('newer text the writer can see');

  await useDoc.getState().flush();
  expect(useDoc.getState().markdown).toBe('newer text the writer can see');
});

// --- failure is visible, in words -------------------------------------------

test('a failed save sets status error with a human-readable message', async () => {
  const { useDoc, api } = freshStore();
  api.putDocument.mockRejectedValue(new Error('Could not reach the server.'));

  useDoc.getState().setMarkdown('words worth keeping');
  await useDoc.getState().flush();

  const s = useDoc.getState();
  expect(s.status).toBe('error');
  expect(typeof s.error).toBe('string');
  expect(s.error).toMatch(/server/i);
  // The text is still on screen and still marked unsaved — nothing is discarded.
  expect(s.markdown).toBe('words worth keeping');
  expect(s.dirty).toBe(true);
});

test('a failed save does not wedge the saver — the next edit still goes out', async () => {
  const { useDoc, api } = freshStore();
  api.putDocument
    .mockRejectedValueOnce(new Error('network down'))
    .mockImplementation(async (body) => snapshot(body.markdown, 3));

  useDoc.getState().setMarkdown('attempt one');
  await useDoc.getState().flush();
  expect(useDoc.getState().status).toBe('error');

  useDoc.getState().setMarkdown('attempt two');
  await useDoc.getState().flush();

  expect(useDoc.getState().status).toBe('idle');
  expect(useDoc.getState().error).toBeNull();
  expect(api.putDocument).toHaveBeenCalledTimes(2);
});

test('a save failure with no message still says something a human can read', async () => {
  const { useDoc, api } = freshStore();
  api.putDocument.mockRejectedValue(new Error(''));

  useDoc.getState().setMarkdown('words');
  await useDoc.getState().flush();

  expect(useDoc.getState().error).toBeTruthy();
  expect((useDoc.getState().error ?? '').length).toBeGreaterThan(10);
});

// --- cold start -------------------------------------------------------------

test('load uses the server document when the backend answers', async () => {
  const { useDoc, api } = freshStore();
  api.getDocument.mockResolvedValue(snapshot('# From the server\n\nHello.', 7));

  await useDoc.getState().load();

  const s = useDoc.getState();
  expect(s.markdown).toBe('# From the server\n\nHello.');
  expect(s.version).toBe(7);
  expect(s.status).toBe('idle');
  expect(s.error).toBeNull();
});

test('load falls back to the seeded sample when the backend is unreachable', async () => {
  const { useDoc, api } = freshStore();
  api.getDocument.mockRejectedValue(new Error('Could not reach the server.'));

  await useDoc.getState().load();

  const s = useDoc.getState();
  expect(s.markdown).toBe(SAMPLE_MARKDOWN);
  expect(s.markdown.length).toBeGreaterThan(0);
  expect(s.status).toBe('error');
  expect(s.error).toMatch(/server/i);
});

test('load falls back to the local copy, not the seed, once the writer has edited', async () => {
  const { useDoc, api } = freshStore();
  api.putDocument.mockImplementation(async (body) =>
    snapshot(body.markdown)
  );
  useDoc.getState().setMarkdown('the writer’s own words');
  await useDoc.getState().flush();

  api.getDocument.mockRejectedValue(new Error('offline'));
  await useDoc.getState().load();

  expect(useDoc.getState().markdown).toBe('the writer’s own words');
  expect(useDoc.getState().status).toBe('error');
});

test('an unconfigured build opens on prose and reports saved, not broken', async () => {
  const { useDoc, api } = freshStore();
  api.apiConfigured.mockReturnValue(false);

  await useDoc.getState().load();

  const s = useDoc.getState();
  expect(s.markdown).toBe(SAMPLE_MARKDOWN);
  expect(s.status).toBe('idle');
  expect(s.error).toBeNull();
  expect(api.getDocument).not.toHaveBeenCalled();

  // And editing locally still resolves to a settled state rather than a
  // permanent "Saving…".
  useDoc.getState().setMarkdown('edited offline');
  await useDoc.getState().flush();
  expect(useDoc.getState().status).toBe('idle');
  expect(api.putDocument).not.toHaveBeenCalled();
});

test('unsaved local work survives a cold start and is not clobbered by the server', async () => {
  const { useDoc, api } = freshStore();
  api.putDocument.mockRejectedValue(new Error('network down'));

  useDoc.getState().setMarkdown('a paragraph the server never got');
  await useDoc.getState().flush();
  expect(useDoc.getState().dirty).toBe(true);

  // Cold start: the server still holds the older text.
  api.getDocument.mockResolvedValue(snapshot('the older text', 4));
  api.putDocument.mockImplementation(async (body) =>
    snapshot(body.markdown, 5)
  );
  await useDoc.getState().load();

  expect(useDoc.getState().markdown).toBe('a paragraph the server never got');
  await useDoc.getState().flush();
  expect(useDoc.getState().status).toBe('idle');
  expect(api.putDocument.mock.calls.at(-1)?.[0]).toMatchObject({
    markdown: 'a paragraph the server never got',
  });
});
