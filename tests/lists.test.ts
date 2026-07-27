import { describe, expect, test } from 'bun:test';
import { apply, type ListAction } from '../src/lists';
import type { SavedTab, TabGroup } from '../src/models';

const tab = (n: number): SavedTab => ({ url: `https://site${n}.com/`, title: `Site ${n}` });
const group = (id: string, over: Partial<TabGroup> = {}): TabGroup =>
  ({ id, name: id, tags: [], tabs: [tab(1), tab(2), tab(3)], createdAt: 0, ...over });

const lists = () => [group('a'), group('b'), group('c')];
const run = (action: ListAction, all = lists()) => ({ all, next: apply(all, action) });

describe('lists', () => {
  test('rename falls back to Untitled list when the field is blank', () => {
    expect(apply(lists(), { kind: 'rename', group: 'a', name: '  Reading  ' })[0].name).toBe('Reading');
    expect(apply(lists(), { kind: 'rename', group: 'a', name: '   ' })[0].name).toBe('Untitled list');
  });

  test('tag-add takes several at once and drops the ones already there', () => {
    const all = [group('a', { tags: ['work'] })];
    expect(apply(all, { kind: 'tag-add', group: 'a', input: 'work, docs , ,rust' })[0].tags)
      .toEqual(['work', 'docs', 'rust']);
  });

  test('tag-add with nothing new is a no-op', () => {
    const { all, next } = run({ kind: 'tag-add', group: 'a', input: ' , ' });
    expect(next).toBe(all);
  });

  test('tag-remove and tab-remove take the index, and ignore one out of range', () => {
    const all = [group('a', { tags: ['x', 'y'] })];
    expect(apply(all, { kind: 'tag-remove', group: 'a', index: 0 })[0].tags).toEqual(['y']);
    expect(apply(all, { kind: 'tag-remove', group: 'a', index: 9 })).toBe(all);
    expect(apply(all, { kind: 'tab-remove', group: 'a', index: 1 })[0].tabs.map(t => t.title))
      .toEqual(['Site 1', 'Site 3']);
    expect(apply(all, { kind: 'tab-remove', group: 'a', index: -1 })).toBe(all);
  });

  test('append puts the tab at the end', () => {
    const next = apply(lists(), { kind: 'append', group: 'b', tab: tab(9) });
    expect(next[1].tabs.map(t => t.title)).toEqual(['Site 1', 'Site 2', 'Site 3', 'Site 9']);
    expect(next[0].tabs).toHaveLength(3);
  });

  test('tab-move and group-move refuse to run off either end', () => {
    expect(apply(lists(), { kind: 'tab-move', group: 'a', index: 0, by: 1 })[0].tabs.map(t => t.title))
      .toEqual(['Site 2', 'Site 1', 'Site 3']);
    expect(apply(lists(), { kind: 'group-move', group: 'c', by: -1 }).map(g => g.id))
      .toEqual(['a', 'c', 'b']);

    const first = run({ kind: 'tab-move', group: 'a', index: 0, by: -1 });
    expect(first.next).toBe(first.all);
    const last = run({ kind: 'group-move', group: 'c', by: 1 });
    expect(last.next).toBe(last.all);
  });

  test('group-remove leaves the others in order', () => {
    expect(apply(lists(), { kind: 'group-remove', group: 'b' }).map(g => g.id)).toEqual(['a', 'c']);
  });

  // The reason callers can drop their `if (!group) return` guards: a list deleted in the
  // other surface between the read and the click resolves to "nothing changed".
  test('an id that is no longer there returns the same array', () => {
    const { all, next } = run({ kind: 'group-remove', group: 'gone' });
    expect(next).toBe(all);
    expect(apply(all, { kind: 'rename', group: 'gone', name: 'x' })).toBe(all);
  });

  test('never mutates what it was given', () => {
    const all = lists();
    const before = structuredClone(all);
    apply(all, { kind: 'rename', group: 'a', name: 'changed' });
    apply(all, { kind: 'tab-move', group: 'a', index: 0, by: 1 });
    apply(all, { kind: 'group-remove', group: 'a' });
    apply(all, { kind: 'append', group: 'a', tab: tab(9) });
    expect(all).toEqual(before);
  });
});
