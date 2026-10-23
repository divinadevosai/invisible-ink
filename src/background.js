// The toolbar button. activeTab lets Invisible Ink read only the tab you clicked it on, only then.
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id == null) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['ink.js'] });
  } catch {
    // browser pages, the extension stores and the PDF viewer can't be read by any extension
    await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#c8321e' });
    await chrome.action.setBadgeText({ tabId: tab.id, text: '×' });
    await chrome.action.setTitle({ tabId: tab.id, title: 'Invisible Ink can’t read browser pages or extension stores' });
    setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: '' }).catch(() => {}), 2500);
  }
});
