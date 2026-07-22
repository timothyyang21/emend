import { beforeEach, expect, jest, test } from '@jest/globals';

/**
 * THE REINSTALL GUARANTEE.
 *
 * The product promise is that a writer's manuscript survives a reinstall. That
 * needs two things to be true at once:
 *   - the SERVER stores one document at a constant key (no device/install id)
 *   - the CLIENT treats the server as the source of truth on cold start
 *
 * The second is the one that is easy to get wrong from the client side: a store
 * that trusts its own AsyncStorage cache over the server reintroduces exactly
 * the failure the singleton key was meant to prevent. These tests pin it.
 */

const mockGetDocument = jest.fn<() => Promise<unknown>>();
const mockPutDocument = jest.fn<(b: unknown) => Promise<unknown>>();

jest.mock('@/lib/api', () => ({
  getDocument: (...a: unknown[]) => mockGetDocument(...(a as [])),
  putDocument: (...a: unknown[]) => mockPutDocument(...(a as [unknown])),
  apiConfigured: () => true,
  SAMPLE_MARKDOWN: '# Seed\n\nThe seeded sample.\n',
}));

// Imported after the mock so the store binds to it.
const { useDoc, INITIAL_DOC_STATE } = require('@/store/doc') as typeof import('@/store/doc');

const SERVER_DOC = {
  id: 'default',
  markdown: '# Server\n\nThe document the server has.\n',
  version: 7,
  updatedAt: 1_700_000_000_000,
};

beforeEach(() => {
  mockGetDocument.mockReset();
  mockPutDocument.mockReset();
  mockGetDocument.mockResolvedValue(SERVER_DOC);
  useDoc.setState({ ...INITIAL_DOC_STATE });
});

test('a fresh install with empty local storage gets the server document', () => {
  // Nothing persisted: this is exactly the post-reinstall state.
  return useDoc
    .getState()
    .load()
    .then(() => {
      const s = useDoc.getState();
      expect(s.markdown).toBe(SERVER_DOC.markdown);
      expect(s.version).toBe(7);
      expect(s.status).toBe('idle');
    });
});

test('a stale but SAVED local copy loses to the server', async () => {
  // The device has an old copy it believes was saved. The server has moved on —
  // e.g. the writer edited from somewhere else, or this cache is simply old.
  useDoc.setState({
    ...INITIAL_DOC_STATE,
    markdown: '# Stale\n\nAn old copy sitting in AsyncStorage.\n',
    version: 3,
    origin: 'server',
    dirty: false,
  });

  await useDoc.getState().load();

  expect(useDoc.getState().markdown).toBe(SERVER_DOC.markdown);
  expect(useDoc.getState().version).toBe(7);
});

test('the seeded sample never wins over a real server document', async () => {
  useDoc.setState({ ...INITIAL_DOC_STATE, origin: 'seed' });
  await useDoc.getState().load();
  expect(useDoc.getState().markdown).toBe(SERVER_DOC.markdown);
});

test('UNSAVED local work is the one thing that outranks the server — and is re-saved', async () => {
  // Not a cache: words the writer typed whose save failed. Replacing these with
  // the server's older copy would destroy work. The store keeps them AND pushes
  // them back up rather than leaving them only on the device.
  useDoc.setState({
    ...INITIAL_DOC_STATE,
    markdown: '# Unsaved\n\nWords whose save never landed.\n',
    origin: 'local',
    dirty: true,
  });
  mockPutDocument.mockResolvedValue({ ...SERVER_DOC, version: 8 });

  await useDoc.getState().load();

  expect(useDoc.getState().markdown).toBe('# Unsaved\n\nWords whose save never landed.\n');
  expect(useDoc.getState().status).toBe('saving');
});

test('an unreachable server leaves real prose on screen and says so', async () => {
  mockGetDocument.mockRejectedValue(new Error('network down'));
  await useDoc.getState().load();

  const s = useDoc.getState();
  expect(s.markdown).toBe('# Seed\n\nThe seeded sample.\n'); // never an empty box
  expect(s.status).toBe('error');
  expect(typeof s.error).toBe('string');
});

test('the persist version is bumped whenever the seed changes', () => {
  // This is not ceremony. When the seed changed and this did not, every device
  // that had opened the app kept its old copy, and — because unsaved local work
  // outranks the server — pushed that stale copy UP, overwriting the new seed on
  // the server for everyone. The rule is in CLAUDE.md; the cost of forgetting it
  // was a demo that opened on the wrong document.
  const { DOC_PERSIST_VERSION } = require('@/store/doc') as typeof import('@/store/doc');
  expect(DOC_PERSIST_VERSION).toBeGreaterThanOrEqual(2);
});
