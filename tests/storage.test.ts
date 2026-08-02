import { expect, test } from 'bun:test';
import { createEmptyGroup } from '../src/storage';

test('createEmptyGroup writes a named empty list', async () => {
  const oldChrome = (globalThis as any).chrome;
  const writes: Record<string, unknown>[] = [];
  (globalThis as any).chrome = {
    storage: { local: { get: async () => ({ groups: [] }), set: async (value: Record<string, unknown>) => writes.push(value) } },
  };
  try {
    const group = await createEmptyGroup('  Reading  ');
    expect(group).toMatchObject({ name: 'Reading', tags: [], tabs: [] });
    expect(writes[0]).toEqual({ groups: [group] });
  } finally {
    (globalThis as any).chrome = oldChrome;
  }
});
