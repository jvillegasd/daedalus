import type { SavedTab, TabGroup } from './models';
import { parseTags } from './tags';

/** Move one entry by `delta` positions, clamped: out-of-range moves return the list unchanged. */
const move = <T>(list: T[], index: number, delta: number) => {
  const to = index + delta;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list];
  next.splice(to, 0, ...next.splice(index, 1));
  return next;
};

/**
 * Every way a surface can change the saved lists. `group` is the list's id rather than its
 * position, because a click and the read that preceded it are two separate awaits — the
 * index can have moved by the time the action is applied, the id cannot.
 *
 * `rename` and `tag-add` carry the raw input value: the "Untitled list" fallback and the
 * tag parsing are rules, and rules belong behind the interface rather than in whichever
 * handler happened to need them first.
 */
export type ListAction =
  | { kind: 'rename'; group: string; name: string }
  | { kind: 'tag-add'; group: string; input: string }
  | { kind: 'tag-remove'; group: string; index: number }
  | { kind: 'append'; group: string; tab: SavedTab }
  | { kind: 'tab-remove'; group: string; index: number }
  | { kind: 'tab-move'; group: string; index: number; by: -1 | 1 }
  | { kind: 'group-move'; group: string; by: -1 | 1 }
  | { kind: 'group-remove'; group: string };

/**
 * The saved lists after the action, or `all` itself when the action changed nothing — an id
 * that no longer exists, a move that would run off the end, a tag already present. Callers
 * compare the reference and skip the storage write and the re-render on a no-op, which is
 * also what makes the "list vanished between the read and the click" case a no-op rather
 * than a guard every caller has to remember.
 *
 * Pure on purpose, and it never mutates `all`.
 */
export const apply = (all: TabGroup[], action: ListAction): TabGroup[] => {
  const at = all.findIndex(g => g.id === action.group);
  if (at < 0) return all;
  const group = all[at];
  const put = (patch: Partial<TabGroup>) => all.map((g, i) => i === at ? { ...g, ...patch } : g);
  const within = (list: unknown[], i: number) => i >= 0 && i < list.length;

  switch (action.kind) {
    case 'rename':
      return put({ name: action.name.trim() || 'Untitled list' });
    case 'tag-add': {
      const added = parseTags(action.input, group.tags);
      return added.length ? put({ tags: [...group.tags, ...added] }) : all;
    }
    case 'tag-remove':
      return within(group.tags, action.index) ? put({ tags: group.tags.filter((_, i) => i !== action.index) }) : all;
    case 'append':
      return group.tabs.some(t => t.url === action.tab.url) ? all : put({ tabs: [...group.tabs, action.tab] });
    case 'tab-remove':
      return within(group.tabs, action.index) ? put({ tabs: group.tabs.filter((_, i) => i !== action.index) }) : all;
    case 'tab-move': {
      const tabs = move(group.tabs, action.index, action.by);
      return tabs === group.tabs ? all : put({ tabs });
    }
    case 'group-move':
      return move(all, at, action.by);
    case 'group-remove':
      return all.filter(g => g.id !== action.group);
    default: {
      // Adding a kind without a case here is a compile error, not a silent no-op.
      const unreachable: never = action;
      return unreachable;
    }
  }
};
