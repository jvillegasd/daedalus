export const setupContextMenus = () => chrome.contextMenus.removeAll(() => {
  chrome.contextMenus.create({ id: 'lens', title: 'Search image with Google Lens', contexts: ['image'] });
  chrome.contextMenus.create({ id: 'bing', title: 'Search image with Bing', contexts: ['image'] });
  chrome.contextMenus.create({ id: 'yandex', title: 'Search image with Yandex', contexts: ['image'] });
  chrome.contextMenus.create({ id: 'pip', title: 'Picture-in-Picture', contexts: ['video', 'page'] });
});
