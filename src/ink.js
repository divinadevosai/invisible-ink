// Injected into the current tab when you click Invisible Ink (or press Alt+Shift+X).
// A second click closes it: the extension's own script world keeps the close function between clicks.
import { openOverlay } from './overlay.js';
import { scanPage } from './page.js';

// invisibleInkCount is read back by background.js for the toolbar badge, which the page can't touch.
if (globalThis.invisibleInkClose) {
  globalThis.invisibleInkClose();
  globalThis.invisibleInkCount = null;
} else {
  const report = scanPage(document);
  globalThis.invisibleInkCount = report.findings.filter((f) => f.level === 'ai').length;
  globalThis.invisibleInkClose = openOverlay(report, { onClose: () => (globalThis.invisibleInkClose = null) });
}
