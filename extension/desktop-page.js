// Stellarium Desktop on a page of the extension's own that draws a chart
// screen: the popup, and the screenshot, paste and import pages. The screen
// gets Send to Stellarium Desktop, placed by the user's default, and the
// button sends its sky and shows how that went, as desktop-model.js words it.
// Every other button is the page's own.
import { desktopHint, BUSY, viewForDesktopSend, withDesktopSend } from "./desktop-model.js";
import { desktopPreferred, setDesktopPreferred } from "./preference.js";
import { HOST_PERMISSION, probe, sendSky } from "./stellarium-desktop.js";
import { render } from "./view.js";

// Kept on this computer only, and not synced: see preference.js. Absent where
// a page runs without the extension, as when it is tried out on a local server.
const prefs = () => globalThis.chrome?.storage?.local ?? null;

/**
 * Draws a chart screen with Send to Stellarium Desktop. A screen that can't
 * send, such as a refusal, is drawn as it is.
 *
 * @param {HTMLElement} container  where the page draws its screens
 * @param {object} base  a chart screen, from viewFor or a model built on it
 * @param {(button: object, sky: object | null, screen: { view: object, onButton: Function }) => unknown} onButton
 *   every button but the desktop ones. screen is the one drawn, with its
 *   buttons, for a further screen whose Cancel goes back to it.
 * @param {{ onDone?: (() => void) | null, changed?: boolean }} [options]
 *   onDone is the sent screen's Done, which draws the chart again when left
 *   out; changed says the user has just switched their default
 */
export async function renderChart(container, base, onButton, { onDone = null, changed = false } = {}) {
  // A preference that can't be read leaves Stellarium Web the default.
  const preferred = await Promise.resolve(prefs())
    .then((storage) => (storage ? desktopPreferred(storage) : false))
    .catch(() => false);
  const view = withDesktopSend(base, { preferred, changed });
  const again = (switched) => renderChart(container, base, onButton, { onDone, changed: switched });

  const chartButtons = (button, sky) => {
    if (button.does === "send-to-desktop") return sendToDesktop(sky);
    if (button.does === "prefer-desktop" || button.does === "prefer-web") {
      return switchDefault(button.does === "prefer-desktop").then(() => again(true));
    }
    return onButton(button, sky, { view, onButton: chartButtons });
  };

  // Stellarium Desktop is reached only from a click. Access to 127.0.0.1 is
  // asked for first, while the click still counts as the user's: the browser
  // asks only the first time, and may refuse a request made after an await.
  // Without access, a request would fail like a closed Stellarium.
  async function sendToDesktop(sky) {
    const allowed = await (globalThis.chrome?.permissions?.request(HOST_PERMISSION) ?? Promise.resolve(false)).catch(() => false);
    if (!allowed) {
      showResult(viewForDesktopSend({ state: "no-permission" }, sky));
      return;
    }
    showResult(BUSY.send);
    showResult(viewForDesktopSend(await sendSky(sky), sky, { preferred }));
  }

  // A problem screen gets Cancel back to the chart, and Try again sends again.
  // The sent screen has Done, and the default to switch.
  function showResult(result) {
    const resultButtons = (button, sky) => {
      if (button.does === "close") return onDone ? onDone() : again(false);
      if (button.does === "prefer-desktop" || button.does === "prefer-web") {
        const toDesktop = button.does === "prefer-desktop";
        return switchDefault(toDesktop).then(() =>
          showResult(viewForDesktopSend({ state: "sent" }, sky, { preferred: toDesktop, changed: true })),
        );
      }
      return chartButtons(button, sky);
    };
    render(container, result, resultButtons, result.state === "desktop-problem" ? view : null);
  }

  render(container, view, chartButtons);
  checkDesktop(container.querySelector(".desktop-hint")).catch(() => {});
}

async function switchDefault(toDesktop) {
  const storage = prefs();
  if (storage) await setDesktopPreferred(storage, toDesktop);
}

/**
 * Once AstroChart Bridge has access to 127.0.0.1, checks Stellarium and says
 * what it found on the line under the desktop button. Without access it
 * doesn't check: the request would fail like a closed Stellarium. The screen
 * is drawn first and the line filled in when the answer comes, so nothing
 * waits on it; a line whose screen has since been replaced is left alone.
 *
 * @param {HTMLElement | null} hint  view.js's desktopHintLine
 */
export async function checkDesktop(hint) {
  const permissions = globalThis.chrome?.permissions;
  if (!hint || !permissions || !(await permissions.contains(HOST_PERMISSION))) return;
  const text = desktopHint(await probe({ timeoutMs: 1000 }));
  if (hint.isConnected) hint.textContent = text;
}
