import { test, expect, jest } from '@jest/globals';

jest.mock('expo-haptics', () => ({
  impactAsync: () => Promise.reject(new Error('no haptics here')),
  notificationAsync: () => Promise.reject(new Error('no haptics here')),
  selectionAsync: () => Promise.reject(new Error('no haptics here')),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: () => Promise.reject(new Error('clipboard unavailable')),
}));

import { copyText } from '@/lib/feel/clipboard';
import { haptics } from '@/lib/feel/haptics';

test('every haptic resolves even when the native module throws', async () => {
  await expect(haptics.tap()).resolves.toBeUndefined();
  await expect(haptics.success()).resolves.toBeUndefined();
  await expect(haptics.warning()).resolves.toBeUndefined();
  await expect(haptics.error()).resolves.toBeUndefined();
  await expect(haptics.selection()).resolves.toBeUndefined();
});

test('copyText resolves false instead of rejecting when the clipboard fails', async () => {
  await expect(copyText('hello')).resolves.toBe(false);
});
