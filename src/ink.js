// Injected into the current tab when you click Invisible Ink (or press Alt+Shift+X).
// A second click closes it: the extension's own script world keeps the close function between clicks.
import { openOverlay } from './overlay.js';
import { scanPage } from './page.js';

if (globalThis.invisibleInkClose) {
  globalThis.invisibleInkClose();
} else {
  const report = scanPage(document);
  globalThis.invisibleInkClose = openOverlay(report, { onClose: () => (globalThis.invisibleInkClose = null) });
}
