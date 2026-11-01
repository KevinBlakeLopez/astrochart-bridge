// The receiving page for a Chart Bridge link. It works without the extension:
// the chart is read from the link's fragment, which the browser never sends to
// the server, and nothing is stored or sent until a button is clicked. Every
// decision is made in import-model.js and drawn by view.js.
import { linkFor, readLink, viewForImport } from "./import-model.js";
import { render } from "./view.js";

const app = document.getElementById("app");
const status = document.getElementById("status");
const linkField = document.getElementById("link");

// The chart on screen, for Copy link. Kept only in this variable.
let chart = null;

show();
// A link pasted into this tab's address bar changes only the fragment, which
// doesn't reload the page.
window.addEventListener("hashchange", show);

function show() {
  const result = readLink(location.hash);
  // The chart comes out of the address and this history entry as soon as it
  // is read, whether or not it was valid: a damaged link can still be read.
  // replaceState doesn't fire hashchange.
  if (location.hash !== "") history.replaceState(null, "", `${location.pathname}${location.search}`);
  chart = result?.kind === "portable" ? result.chart : null;
  status.textContent = "";
  linkField.hidden = true;
  linkField.value = "";
  render(app, viewForImport(result), onButton);
}

// The click is the confirmation: the notes above the buttons say what each
// one sends where. Destinations open in a new tab with no opener or referrer.
async function onButton({ url, does }) {
  if (does === "copy") {
    await copyLink();
    return;
  }
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

// writeText is called before anything is awaited, so Safari still counts the
// click as the reason for it. A browser that refuses gets the link to select.
async function copyLink() {
  if (chart === null) return;
  const link = linkFor(location.href, chart);
  try {
    await navigator.clipboard.writeText(link);
    status.textContent = "Link copied.";
  } catch {
    status.textContent = "This browser didn't let Chart Bridge copy the link. Copy it from here instead:";
    linkField.value = link;
    linkField.hidden = false;
    linkField.select();
  }
}
