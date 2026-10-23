// The toolbar button. activeTab lets Invisible Ink read only the tab you clicked it on, only then.
// The count of messages for AI goes on the toolbar badge: unlike the card drawn in the page, a page can't hide or fake it.
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id == null) return;
  const tabId = tab.id;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['ink.js'] });
    const [{ result: n } = {}] = await chrome.scripting.executeScript({ target: { tabId }, func: () => globalThis.invisibleInkCount });
    if (typeof n !== 'number') return clear(tabId);
    await chrome.action.setBadgeBackgroundColor({ tabId, color: n ? '#c8321e' : '#2e6b3a' });
    await chrome.action.setBadgeText({ tabId, text: n ? String(Math.min(n, 99)) : '✓' });
    await chrome.action.setTitle({ tabId, title: n ? `Invisible Ink: ${n} ${n === 1 ? 'message' : 'messages'} for AI on this page` : 'Invisible Ink: nothing addressed to AI on this page' });
  } catch {
    // browser pages, the extension stores and the PDF viewer can't be read by any extension
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#6b6460' });
    await chrome.action.setBadgeText({ tabId, text: '×' });
    await chrome.action.setTitle({ tabId, title: 'Invisible Ink can’t read browser pages or extension stores' });
    setTimeout(() => clear(tabId).catch(() => {}), 2500);
  }
});

const clear = async (tabId) => {
  await chrome.action.setBadgeText({ tabId, text: '' });
  await chrome.action.setTitle({ tabId, title: chrome.runtime.getManifest().action.default_title });
};

// a new page in the tab: the old count no longer applies
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading') clear(tabId).catch(() => {});
});
