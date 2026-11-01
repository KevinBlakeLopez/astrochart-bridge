import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { astroSeekUrl } from "../extension/core/astroseek.js";
import { stellariumUrl } from "../extension/core/stellarium.js";
import { readSky, sendSky } from "../extension/stellarium-desktop.js";

const SERVER = "Stellarium RemoteControl 0.0.3";

// A stand-in for Stellarium's Remote Control server, following MainService and
// LocationService in v25.1: query and form parameters, "ok" as text even for
// values it ignores, coordinates kept as single-precision floats. Like its
// HTTP server (qtwebapp's httprequest.cpp), it reads a body only when the
// header is spelled "Content-Length": Node's and undici's lowercase
// content-length was ignored by Stellarium 25.1.0 on 2026-11-01. Each test
// gets its own on a free port of 127.0.0.1.
async function mockStellarium(options = {}) {
  const state = { jday: 2461000.5, timerate: 1 / 86400, lat: Math.fround(48.85), lng: Math.fround(2.35), planet: "Earth", name: "Paris", ...options.state };
  const requests = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const url = new URL(req.url, "http://127.0.0.1");
    requests.push({ method: req.method, path: url.pathname, query: url.search.slice(1), authorization: req.headers.authorization ?? null, body });
    if (options.hang) return;
    if (options.serverHeader !== null) res.setHeader("Server", options.serverHeader ?? SERVER);
    if (options.status) {
      res.writeHead(options.status).end(options.statusBody ?? "");
      return;
    }
    const headerNames = req.rawHeaders.filter((_, index) => index % 2 === 0);
    const contentType = req.headers["content-type"] ?? "";
    const bodyRead = headerNames.includes("Content-Length") && (contentType === "" || contentType.startsWith("application/x-www-form-urlencoded"));
    const params = new URLSearchParams(bodyRead && body ? `${url.search.slice(1)}&${body}` : url.search);
    res.setHeader("Content-Type", "text/plain");
    if (req.method === "GET" && url.pathname === "/api/main/status") {
      res.end(options.statusText ?? JSON.stringify({
        location: { name: state.name, planet: state.planet, latitude: state.lat, longitude: state.lng, altitude: 10 },
        time: { jday: state.jday, timerate: state.timerate, isTimeNow: false },
        view: { fov: 60 },
      }));
    } else if (req.method === "POST" && url.pathname === "/api/main/time") {
      if (options.rejectTime && params.has("time")) return res.end("error: invalid time value");
      if (!params.has("time") && !params.has("timerate")) return res.end("error: invalid parameters, use time/timerate as double values");
      if (params.has("time")) state.jday = Number(params.get("time"));
      if (params.has("timerate")) state.timerate = Number(params.get("timerate"));
      res.end("ok");
    } else if (req.method === "POST" && url.pathname === "/api/location/setlocationfields") {
      if (!options.ignoreLocation) {
        state.lat = Math.fround(Number(params.get("latitude")));
        state.lng = Math.fround(Number(params.get("longitude")));
        state.name = `${state.lat}, ${state.lng}`;
      }
      res.end("ok");
    } else {
      res.writeHead(400).end("unsupported operation");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { port: server.address().port, state, requests, close: () => new Promise((resolve) => server.closeAllConnections() || server.close(resolve)) };
}

// A port nothing listens on: one the system just handed out and took back.
async function closedPort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

const NY_1944 = { utc: "1944-01-10T16:00:00Z", lat: 40.716667, lng: -74 };
const SYDNEY = { utc: "2024-01-14T21:00:00Z", lat: -33.866667, lng: 151.2 };

test("sendSky pauses, sets the place, sets the time, then checks the status", async (t) => {
  const stellarium = await mockStellarium();
  t.after(stellarium.close);

  const result = await sendSky(NY_1944, { port: stellarium.port });

  assert.deepEqual(result, { state: "sent" });
  assert.deepEqual(
    stellarium.requests.map(({ method, path, query, body }) => [method, path, query, body]),
    [
      ["GET", "/api/main/status", "", ""],
      ["POST", "/api/main/time", "timerate=0", ""],
      ["POST", "/api/location/setlocationfields", "latitude=40.716667&longitude=-74", ""],
      ["POST", "/api/main/time", `time=${2431100.1666666665}`, ""],
      ["GET", "/api/main/status", "", ""],
    ],
  );
  assert.equal(stellarium.state.timerate, 0);
});

// The reason sendSky puts its parameters in the query string: fetch in Node
// sends a lowercase content-length, which Stellarium doesn't see.
test("the mock, like Stellarium, ignores a form body sent by Node's fetch", async (t) => {
  const stellarium = await mockStellarium();
  t.after(stellarium.close);
  const response = await fetch(`http://127.0.0.1:${stellarium.port}/api/main/time`, {
    method: "POST",
    body: new URLSearchParams({ timerate: "0" }),
  });
  assert.equal(await response.text(), "error: invalid parameters, use time/timerate as double values");
});

test("sendSky: no request carries a password or a cookie", async (t) => {
  const stellarium = await mockStellarium();
  t.after(stellarium.close);
  await sendSky(SYDNEY, { port: stellarium.port });
  assert.ok(stellarium.requests.every(({ authorization }) => authorization === null));
});

test("Sydney goes to Stellarium and comes back as the same sky", async (t) => {
  const stellarium = await mockStellarium();
  t.after(stellarium.close);

  assert.deepEqual(await sendSky(SYDNEY, { port: stellarium.port }), { state: "sent" });
  assert.deepEqual(await readSky({ port: stellarium.port }), {
    state: "connected",
    sky: { utc: "2024-01-14T21:00:00Z", lat: -33.86667, lng: 151.2 },
  });
});

test("readSky's sky opens in the existing Stellarium Web and Astro-Seek links", async (t) => {
  const stellarium = await mockStellarium({ state: { jday: 2431100.1666666665, timerate: 0, lat: Math.fround(40.716667), lng: -74 } });
  t.after(stellarium.close);

  const { sky } = await readSky({ port: stellarium.port });
  assert.equal(stellariumUrl(sky), "https://stellarium-web.org/?date=1944-01-10T16%3A00%3A00Z&lat=40.716667&lng=-74");
  const astroSeek = new URL(astroSeekUrl(sky)).searchParams;
  assert.deepEqual(
    ["narozeni_den", "narozeni_mesic", "narozeni_rok", "narozeni_hodina", "narozeni_minuta", "narozeni_sirka_stupne", "narozeni_sirka_minuty", "narozeni_delka_stupne", "narozeni_delka_minuty", "narozeni_delka_smer"].map((key) => astroSeek.get(key)),
    ["10", "1", "1944", "16", "00", "40", "43", "74", "0", "1"],
  );
});

test("readSky only reads: one GET and nothing else", async (t) => {
  const stellarium = await mockStellarium();
  t.after(stellarium.close);
  await readSky({ port: stellarium.port });
  assert.deepEqual(stellarium.requests.map(({ method, path }) => [method, path]), [["GET", "/api/main/status"]]);
});

test("a Stellarium that answers ok but ignores the place is a mismatch, not a success", async (t) => {
  const stellarium = await mockStellarium({ ignoreLocation: true });
  t.after(stellarium.close);
  assert.deepEqual(await sendSky(NY_1944, { port: stellarium.port }), { state: "mismatch", mismatches: ["latitude", "longitude"] });
});

test("a POST answered with an error is a failed request, and nothing after it is sent", async (t) => {
  const stellarium = await mockStellarium({ rejectTime: true });
  t.after(stellarium.close);
  assert.deepEqual(await sendSky(NY_1944, { port: stellarium.port }), { state: "request-failed", code: "rejected" });
  assert.equal(stellarium.requests.length, 4);
});

test("an observer on Mars is refused before anything is changed", async (t) => {
  const stellarium = await mockStellarium({ state: { planet: "Mars" } });
  t.after(stellarium.close);
  assert.deepEqual(await sendSky(NY_1944, { port: stellarium.port }), { state: "refused", reason: "stellarium-not-earth" });
  assert.deepEqual(await readSky({ port: stellarium.port }), { state: "refused", reason: "stellarium-not-earth" });
  assert.ok(stellarium.requests.every(({ method }) => method === "GET"));
});

test("a date before the Gregorian calendar is refused before connecting", async (t) => {
  const stellarium = await mockStellarium();
  t.after(stellarium.close);
  const result = await sendSky({ ...NY_1944, utc: "1500-01-01T00:00:00Z" }, { port: stellarium.port });
  assert.deepEqual(result, { state: "refused", reason: "stellarium-date-out-of-range" });
  assert.equal(stellarium.requests.length, 0);
});

test("nothing listening is unavailable", async () => {
  const port = await closedPort();
  assert.deepEqual(await readSky({ port }), { state: "unavailable" });
  assert.deepEqual(await sendSky(SYDNEY, { port }), { state: "unavailable" });
});

test("a server that never answers times out", async (t) => {
  const stellarium = await mockStellarium({ hang: true });
  t.after(stellarium.close);
  assert.deepEqual(await readSky({ port: stellarium.port, timeoutMs: 100 }), { state: "request-failed", code: "timeout" });
});

test("Stellarium asking for its password is auth-required", async (t) => {
  const stellarium = await mockStellarium({ status: 401, statusBody: "HTTP 401 Not Authorized" });
  t.after(stellarium.close);
  assert.deepEqual(await readSky({ port: stellarium.port }), { state: "auth-required" });
  assert.deepEqual(await sendSky(SYDNEY, { port: stellarium.port }), { state: "auth-required" });
});

test("another program on the port is an invalid response, and gets no POST", async (t) => {
  const stellarium = await mockStellarium({ serverHeader: "nginx/1.25.3" });
  t.after(stellarium.close);
  assert.deepEqual(await readSky({ port: stellarium.port }), { state: "invalid-response" });
  assert.deepEqual(await sendSky(SYDNEY, { port: stellarium.port }), { state: "invalid-response" });
  assert.ok(stellarium.requests.every(({ method }) => method === "GET"));
});

test("a 401 from another program is an invalid response, not a password prompt", async (t) => {
  const stellarium = await mockStellarium({ status: 401, serverHeader: null });
  t.after(stellarium.close);
  assert.deepEqual(await readSky({ port: stellarium.port }), { state: "invalid-response" });
});

test("an HTTP error from Stellarium is a failed request with its status", async (t) => {
  const stellarium = await mockStellarium({ status: 500 });
  t.after(stellarium.close);
  assert.deepEqual(await readSky({ port: stellarium.port }), { state: "request-failed", code: "http-500" });
});

test("a status that isn't JSON, or isn't Stellarium's shape, is an invalid response", async (t) => {
  for (const statusText of ["<html>", "{}", JSON.stringify({ time: { jday: "soon" }, location: {} })]) {
    const stellarium = await mockStellarium({ statusText });
    t.after(stellarium.close);
    assert.deepEqual(await readSky({ port: stellarium.port }), { state: "invalid-response" }, statusText);
  }
});

test("only a port on this machine can be given", async () => {
  for (const port of [0, 65536, 80.5, "8090", "evil.example:80"]) {
    await assert.rejects(readSky({ port }), /port/);
  }
});
