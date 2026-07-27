import { beforeEach, describe, expect, test } from 'bun:test';
import { defaults, key } from '../src/models';
import { activeOn, liveField, read, toggleDomain, toggled, write } from '../src/preferences';

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

// The bug these replaced: whichever list the global switch did not consult was inert, so a
// per-site button wrote to it, flipped its own pressed state, and changed nothing on the page.
describe('per-site scope', () => {
  const prefs = (patch: Partial<typeof defaults>) => ({ ...defaults, ...patch });

  test('with the global on, everything is covered except the exclusions', () => {
    const p = prefs({ consentEnabled: true, consentExcluded: ['bank.com'] });
    expect(activeOn('consent', p, 'https://news.com/x')).toBe(true);
    expect(activeOn('consent', p, 'https://bank.com/x')).toBe(false);
  });

  test('with the global off, only the inclusions are covered', () => {
    const p = prefs({ consentEnabled: false, consentDomains: ['news.com'] });
    expect(activeOn('consent', p, 'https://news.com/x')).toBe(true);
    expect(activeOn('consent', p, 'https://other.com/x')).toBe(false);
  });

  test('a click writes to the list the global actually consults', () => {
    expect(liveField('consent', prefs({ consentEnabled: true }))).toBe('consentExcluded');
    expect(liveField('consent', prefs({ consentEnabled: false }))).toBe('consentDomains');
    expect(liveField('dark', prefs({ darkEnabled: true }))).toBe('darkExcluded');
    expect(liveField('dark', prefs({ darkEnabled: false }))).toBe('darkDomains');
    expect(liveField('autoplay', prefs({ autoplayEnabled: true }))).toBe('autoplayAllowlist');
    expect(liveField('autoplay', prefs({ autoplayEnabled: false }))).toBe('autoplayDomains');
  });

  test('the list the global ignores cannot change the outcome', () => {
    // Writing to it was the whole bug — the button moved, the page did not.
    expect(activeOn('consent', prefs({ consentEnabled: true, consentDomains: ['a.com'] }), 'https://a.com/')).toBe(true);
    expect(activeOn('consent', prefs({ consentEnabled: true, consentDomains: [] }), 'https://a.com/')).toBe(true);
    expect(activeOn('dark', prefs({ darkEnabled: false, darkExcluded: ['a.com'] }), 'https://a.com/')).toBe(false);
  });

  test('subdomains follow their parent, the same as every other domain rule', () => {
    expect(activeOn('dark', prefs({ darkEnabled: true, darkExcluded: ['example.com'] }), 'https://app.example.com/')).toBe(false);
  });

  // The three rules it replaced, reproduced exactly, so an upgrade changes nothing:
  // dark/autoplay were `global && !exclude`, consent was `global || include`.
  test('the defaults reproduce what the hand-written rules did', () => {
    expect(activeOn('dark', defaults, 'https://a.com/')).toBe(false);        // darkEnabled false
    expect(activeOn('autoplay', defaults, 'https://a.com/')).toBe(true);     // autoplayEnabled true
    expect(activeOn('consent', defaults, 'https://a.com/')).toBe(false);     // consentEnabled false, list empty
  });
});
