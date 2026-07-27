import { beforeEach, describe, expect, test } from 'bun:test';
import { defaults, key } from '../src/models';
import { read, toggleDomain, toggled, write } from '../src/preferences';

/** A sync area that starts out as a profile nothing has ever written. */
let stored: Record<string, unknown>;
beforeEach(() => {
  stored = {};
  (globalThis as any).chrome = {
    storage: { sync: {
      get: async (k: string) => (k in stored ? { [k]: stored[k] } : {}),
      set: async (patch: Record<string, unknown>) => { Object.assign(stored, patch); },
    } },
  };
});

describe('preferences', () => {
  test('a profile that has never been written reads as the defaults', async () => {
    expect(await read()).toEqual(defaults);
  });

  test('a partial stored value is filled in, not taken as the whole', async () => {
    stored[key.prefs] = { darkEnabled: true };
    const p = await read();
    expect(p.darkEnabled).toBe(true);
    expect(p.cleanerMinutes).toBe(defaults.cleanerMinutes);   // the field nobody wrote
    expect(p.consentDomains).toEqual([]);                     // and every list is still a list
  });

  test('writing one field leaves the rest alone', async () => {
    await write({ cleanerMinutes: 15 });
    await write({ cleanerListName: 'Stale' });
    expect(await read()).toMatchObject({ cleanerMinutes: 15, cleanerListName: 'Stale', cleanerEnabled: defaults.cleanerEnabled });
  });
});

describe('domain toggles', () => {
  test('absent means add, present means remove', () => {
    expect(toggled([], 'a.com')).toEqual(['a.com']);
    expect(toggled(['a.com', 'b.com'], 'a.com')).toEqual(['b.com']);
    const list = ['a.com'];
    expect(toggled(list, 'b.com')).not.toBe(list);   // never mutates
    expect(list).toEqual(['a.com']);
  });

  test('toggleDomain persists, and resolves to the state afterwards', async () => {
    expect(await toggleDomain('darkExcluded', 'a.com')).toBe(true);
    expect((await read()).darkExcluded).toEqual(['a.com']);

    expect(await toggleDomain('darkExcluded', 'a.com')).toBe(false);
    expect((await read()).darkExcluded).toEqual([]);
  });

  test('toggling one list does not disturb the other two', async () => {
    await toggleDomain('darkExcluded', 'a.com');
    await toggleDomain('autoplayAllowlist', 'b.com');
    const p = await read();
    expect(p.darkExcluded).toEqual(['a.com']);
    expect(p.autoplayAllowlist).toEqual(['b.com']);
    expect(p.consentDomains).toEqual([]);
  });

  test('toggling a list that has never been written starts from the default, not undefined', async () => {
    expect(await toggleDomain('consentDomains', 'a.com')).toBe(true);
    expect((await read()).consentDomains).toEqual(['a.com']);
  });
});
