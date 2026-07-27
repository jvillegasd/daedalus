import { describe, expect, test } from 'bun:test';
import { rejectLabel } from '../src/consent';

describe('consent labels', () => {
  test('matches the ways a banner says no', () => {
    for (const label of ['Reject all', 'Decline', 'Refuse cookies', 'Only necessary', 'Accept necessary cookies only', 'Continue without accepting'])
      expect(rejectLabel.test(label)).toBe(true);
  });

  test('leaves accept buttons and prose alone', () => {
    for (const label of ['Accept all', 'OK', 'Manage preferences', 'We never reject your choices'])
      expect(rejectLabel.test(label)).toBe(false);
  });
});
