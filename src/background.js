// The toolbar button. activeTab lets Invisible Ink read only the tab you clicked it on, only then.
// The count of messages for AI goes on the toolbar badge: unlike the card drawn in the page, a page can't hide or fake it.
async function run(tab) {
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
    // New tab, settings, the extension stores, PDFs and other extensions' pages are closed to every extension.
    // Say so in a small card under the button; if the browser won't open it now, the next click will.
    await chrome.action.setPopup({ tabId, popup: 'cant.html' });
    await chrome.action.openPopup?.({ windowId: tab.windowId }).catch(() => {});
  }
}
chrome.action.onClicked.addListener(run);

const clear = async (tabId) => {
  await chrome.action.setBadgeText({ tabId, text: '' });
  await chrome.action.setTitle({ tabId, title: chrome.runtime.getManifest().action.default_title });
};

// a new page in the tab: the old count, or the "can't read this page" card, no longer applies
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status !== 'loading') return;
  clear(tabId).catch(() => {});
  chrome.action.setPopup({ tabId, popup: '' }).catch(() => {});
});
