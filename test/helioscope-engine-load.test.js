import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createEngine } from "../extension/helioscope-engine.js";

// When the WebAssembly can't be loaded, createEngine rejects: it doesn't hang
// or leave anything behind, so a page can catch the rejection and say the
// calculation is unavailable. The glue always loads swisseph.wasm from beside
// itself, so each test breaks the file in a copy of the engine and its
// package, in a folder of its own.
const extension = new URL("../extension/", import.meta.url);

function brokenCopy(t, breakWasm) {
  const folder = mkdtempSync(join(tmpdir(), "helioscope-load-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  cpSync(new URL("helioscope-engine.js", extension), join(folder, "helioscope-engine.js"));
  cpSync(new URL("vendor/swisseph/", extension), join(folder, "vendor", "swisseph"), { recursive: true });
  // ES modules, as the repository's own package.json has them read.
  writeFileSync(join(folder, "package.json"), '{ "type": "module" }\n');
  breakWasm(join(folder, "vendor", "swisseph", "wasm", "swisseph.wasm"));
  return pathToFileURL(join(folder, "helioscope-engine.js")).href;
}

// The glue writes why it failed to stderr before rejecting, as @kuntay/swisseph
// has it do in Node (a browser's console gets it instead). It's kept out of
// the test output, and shown if the test fails.
async function failureOf(create) {
  const lines = [];
  const write = process.stderr.write;
  process.stderr.write = (chunk) => {
    lines.push(String(chunk).trim());
    return true;
  };
  try {
    await create();
    return { rejected: false, lines };
  } catch (error) {
    return { rejected: true, error, lines };
  } finally {
    process.stderr.write = write;
  }
}

const BROKEN = {
  "missing": (wasm) => rmSync(wasm),
  "not WebAssembly": (wasm) => writeFileSync(wasm, "not a wasm file"),
};

for (const [name, breakWasm] of Object.entries(BROKEN)) {
  test(`createEngine: with swisseph.wasm ${name}, it rejects, and leaves nothing behind`, { timeout: 10_000 }, async (t) => {
    const unhandled = [];
    const onUnhandled = (reason) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    t.after(() => process.off("unhandledRejection", onUnhandled));
    const exitCode = process.exitCode;

    const { createEngine: createBroken } = await import(brokenCopy(t, breakWasm));
    const failure = await failureOf(() => createBroken());
    assert.ok(failure.rejected, `it resolved; the glue wrote: ${failure.lines.join(" | ")}`);
    assert.ok(failure.error instanceof Error, `it rejected with ${failure.error}`);

    // A rejection nobody handled would be reported by now.
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(unhandled, []);
    assert.equal(process.exitCode, exitCode);
    // And the engine still loads from its own files.
    const engine = await createEngine();
    engine.dispose();
  });
}
