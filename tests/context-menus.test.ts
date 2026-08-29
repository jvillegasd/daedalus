import { beforeEach, describe, expect, test } from 'bun:test';
import { setupContextMenus } from '../src/context-menus';

describe('context menus', () => {
  beforeEach(() => {
    (globalThis as any).chrome = {
      contextMenus: {
        removeAll: (done: () => void) => done(),
        create: (menu: unknown) => created.push(menu),
      },
    };
    created = [];
  });

  let created: unknown[];

  test('rebuilds menus when the worker starts', () => {
    setupContextMenus();
    expect(created).toEqual([
      { id: 'lens', title: 'Search image with Google Lens', contexts: ['image'] },
      { id: 'bing', title: 'Search image with Bing', contexts: ['image'] },
      { id: 'yandex', title: 'Search image with Yandex', contexts: ['image'] },
      { id: 'pip', title: 'Picture-in-Picture', contexts: ['video', 'page'] },
    ]);
  });
});
