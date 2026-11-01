// Talks to Stellarium Desktop's Remote Control plugin on this computer, and
// only on this computer: every request goes to 127.0.0.1. Nothing here runs on
// its own; the popup calls it when the user clicks. What each request means is
// decided in core/stellarium-desktop.js.
import { PORT, checkApplied, isStellariumServer, readStatus, skyFromStatus, transferRequests } from "./core/stellarium-desktop.js";

// The access the browser has to grant first: the manifest's optional host
// permission, for any port on this computer.
export const HOST_PERMISSION = { origins: ["http://127.0.0.1/*"] };

// The plugin answers on this computer within milliseconds; a server that takes
// longer than this isn't going to.
const TIMEOUT_MS = 3000;

/**
 * The sky Stellarium is showing now. Sends one GET and changes nothing.
 *
 * @param {{ port?: number, timeoutMs?: number }} [options]  for tests; the popup leaves both out
 * @returns {Promise<{ state: "connected", sky: { utc: string, lat: number, lng: number } } | Failure>}
 */
export async function readSky(options = {}) {
  const status = await getStatus(connection(options));
  if (status.state !== "ok") return status;
  const result = skyFromStatus(status.status);
  return result.kind === "refused" ? { state: "refused", reason: result.reason } : { state: "connected", sky: result.sky };
}

/**
 * Whether a send could work now: Stellarium answers, and its observer is on
 * Earth. The date it shows doesn't matter, since a send replaces it. Sends
 * one GET and changes nothing.
 *
 * @param {{ port?: number, timeoutMs?: number }} [options]  as for readSky
 * @returns {Promise<{ state: "connected" } | Failure>}
 */
export async function probe(options = {}) {
  const status = await getStatus(connection(options));
  if (status.state !== "ok") return status;
  return status.status.planet === "Earth" ? { state: "connected" } : { state: "refused", reason: "stellarium-not-earth" };
}

/**
 * Puts a sky on Stellarium, pausing its clock, and checks from Stellarium's
 * own status that it took. Stops at the first request that fails.
 *
 * @param {{ utc: string, lat: number, lng: number }} sky
 * @param {{ port?: number, timeoutMs?: number }} [options]  as for readSky
 * @returns {Promise<{ state: "sent" } | { state: "mismatch", mismatches: ReturnType<typeof checkApplied> } | Failure>}
 */
export async function sendSky(sky, options = {}) {
  const plan = transferRequests(sky);
  if (plan.kind === "refused") return { state: "refused", reason: plan.reason };
  const to = connection(options);

  // Nothing is sent to a server that hasn't shown it is Stellarium, on Earth.
  const before = await getStatus(to);
  if (before.state !== "ok") return before;
  if (before.status.planet !== "Earth") return { state: "refused", reason: "stellarium-not-earth" };

  for (const { path, params } of plan.requests) {
    const response = await call(to, `${path}?${params}`, { method: "POST" });
    if (response.state !== "ok") return response;
    // The plugin writes "error: ..." with a 200 for a value it can't use.
    if (response.text.trim() !== "ok") return failed("rejected");
  }

  const after = await getStatus(to);
  if (after.state !== "ok") return after;
  const mismatches = checkApplied(sky, after.status);
  return mismatches.length === 0 ? { state: "sent" } : { state: "mismatch", mismatches };
}

/**
 * @typedef {{ state: "unavailable" } | { state: "auth-required" } | { state: "invalid-response" }
 *   | { state: "request-failed", code: string } | { state: "refused", reason: string }} Failure
 *   unavailable covers Stellarium being closed and its server being off alike:
 *   both refuse the connection.
 */

const failed = (code) => ({ state: "request-failed", code });

function connection({ port = PORT, timeoutMs = TIMEOUT_MS }) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Stellarium's port must be 1 to 65535, got ${port}`);
  return { origin: `http://127.0.0.1:${port}`, timeoutMs };
}

async function getStatus(to) {
  const response = await call(to, "/api/main/status", { method: "GET" });
  if (response.state !== "ok") return response;
  let json;
  try {
    json = JSON.parse(response.text);
  } catch {
    return { state: "invalid-response" };
  }
  const status = readStatus(json);
  return status === null ? { state: "invalid-response" } : { state: "ok", status };
}

// One request with no body, its answer read as text. No cookies or saved
// passwords go with it, and a redirect elsewhere is an error rather than followed.
async function call({ origin, timeoutMs }, path, { method }) {
  try {
    const response = await fetch(`${origin}${path}`, {
      method,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!isStellariumServer(response.headers.get("Server"))) return { state: "invalid-response" };
    if (response.status === 401) return { state: "auth-required" };
    if (!response.ok) return failed(`http-${response.status}`);
    return { state: "ok", text: await response.text() };
  } catch (error) {
    return error?.name === "TimeoutError" ? failed("timeout") : { state: "unavailable" };
  }
}
