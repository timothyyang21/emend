import { test, expect } from '@jest/globals';

import { isDictationSupported } from '@/lib/writing/useDictation';

test('dictation is unsupported off-web (no SpeechRecognition)', () => {
  expect(isDictationSupported()).toBe(false);
});
