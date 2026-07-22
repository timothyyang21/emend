// jest-expo setup: mock AsyncStorage so persisted stores work in tests.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// expo/fetch (used by src/lib/ai/proxy.ts for streaming) subclasses the native
// Response object, which isn't available in the jsdom/node test environment.
// Mock it globally so any module that transitively imports '@/lib/ai' loads
// safely under Jest; only real device/web builds exercise the real fetch.
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
