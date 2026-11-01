import { test } from "node:test";
import assert from "node:assert/strict";
import { readPickles } from "../extension/core/pickle.js";

const hex = (text) => Uint8Array.from(text.match(/../g), (pair) => parseInt(pair, 16));
const bytes = (text) => Uint8Array.from(text, (char) => char.charCodeAt(0));
const concat = (...parts) => Uint8Array.from(parts.flatMap((part) => [...part]));

// pickle.dumps(value, protocol).hex() on CPython 3.9.9, for each protocol.
const TEXT = "Nagy Róbert 東京 \\ x\ny";
const CPYTHON = [
  [TEXT, [
    "564e6167792052f362657274205c75363737315c7534656163205c753030356320785c7530303061790a70300a2e",
    "58190000004e6167792052c3b36265727420e69db1e4baac205c20780a7971002e",
    "800258190000004e6167792052c3b36265727420e69db1e4baac205c20780a7971002e",
    "800358190000004e6167792052c3b36265727420e69db1e4baac205c20780a7971002e",
    "8004951d000000000000008c194e6167792052c3b36265727420e69db1e4baac205c20780a79942e",
    "8005951d000000000000008c194e6167792052c3b36265727420e69db1e4baac205c20780a79942e",
  ]],
  ["😀", [
    "565c5530303031663630300a70300a2e",
    "5804000000f09f988071002e",
    "80025804000000f09f988071002e",
    "80035804000000f09f988071002e",
    "80049508000000000000008c04f09f9880942e",
    "80059508000000000000008c04f09f9880942e",
  ]],
  ["", ["560a70300a2e", "580000000071002e", "8002580000000071002e", "8003580000000071002e",
    "80049504000000000000008c00942e", "80059504000000000000008c00942e"]],
  [true, ["4930310a2e", "4930310a2e", "8002882e", "8003882e", "8004882e", "8005882e"]],
  [false, ["4930300a2e", "4930300a2e", "8002892e", "8003892e", "8004892e", "8005892e"]],
  [7, ["49370a2e", "4b072e", "80024b072e", "80034b072e", "80044b072e", "80054b072e"]],
  [1583, ["49313538330a2e", "4d2f062e", "80024d2f062e", "80034d2f062e",
    "80049504000000000000004d2f062e", "80059504000000000000004d2f062e"]],
  [70000, ["4937303030300a2e", "4a701101002e", "80024a701101002e", "80034a701101002e",
    "80049506000000000000004a701101002e", "80059506000000000000004a701101002e"]],
  [-430, ["492d3433300a2e", "4a52feffff2e", "80024a52feffff2e", "80034a52feffff2e",
    "80049506000000000000004a52feffff2e", "80059506000000000000004a52feffff2e"]],
  [10.5, ["4631302e350a2e", "4740250000000000002e", "80024740250000000000002e", "80034740250000000000002e",
    "8004950a000000000000004740250000000000002e", "8005950a000000000000004740250000000000002e"]],
  [null, ["4e2e", "4e2e", "80024e2e", "80034e2e", "80044e2e", "80054e2e"]],
];

for (const [value, pickles] of CPYTHON) {
  test(`reads ${JSON.stringify(value)} as CPython pickles it in protocols 0 to 5`, () => {
    pickles.forEach((pickle, protocol) => {
      const read = readPickles(hex(pickle), 1);
      assert.equal(read.kind, "pickles", `protocol ${protocol}`);
      assert.deepEqual(read.values, [value], `protocol ${protocol}`);
      assert.equal(read.guessedText, false);
    });
  });
}

test("gives the protocol a file was written with", () => {
  const protocolOf = (pickle) => readPickles(hex(pickle), 1).protocol;
  assert.equal(protocolOf(CPYTHON[0][1][0]), 0);
  // Protocol 1 has no PROTO opcode: its binary opcodes show it.
  assert.equal(protocolOf(CPYTHON[0][1][1]), 1);
  assert.equal(protocolOf(CPYTHON[0][1][4]), 4);
  // Protocol 1 writes booleans in protocol 0's form, so a file is as new as its newest pickle.
  const mixed = concat(hex(CPYTHON[3][1][1]), hex(CPYTHON[0][1][1]));
  assert.equal(readPickles(mixed, 2).protocol, 1);
});

test("reads several pickles one after another", () => {
  const file = concat(hex(CPYTHON[0][1][2]), hex(CPYTHON[3][1][2]), hex(CPYTHON[6][1][2]));
  assert.deepEqual(readPickles(file, 3), { kind: "pickles", values: [TEXT, true, 1583], protocol: 2, guessedText: false });
});

test("reads what Python 2 writes", () => {
  // A long integer, and a byte string in ASCII.
  assert.deepEqual(readPickles(bytes("L5L\n."), 1).values, [5]);
  assert.deepEqual(readPickles(bytes("S'It\\'s'\np0\n."), 1).values, ["It's"]);
  assert.deepEqual(readPickles(bytes('S"a\\tb\\\\c"\n.'), 1).values, ["a\tb\\c"]);
  // A byte string names no code page: anything but ASCII is a guess.
  assert.deepEqual(readPickles(bytes("S'Nagy \\xf5'\np0\n."), 1), {
    kind: "pickles",
    values: ["Nagy õ"],
    protocol: 0,
    guessedText: true,
  });
  assert.deepEqual(readPickles(Uint8Array.of(0x80, 0x02, 0x55, 3, 0x61, 0x62, 0xf5, 0x2e), 1).values, ["abõ"]);
});

test("decodes raw-unicode-escape as CPython does", () => {
  // Latin-1 bytes as themselves; \u only after an odd run of backslashes.
  assert.deepEqual(readPickles(Uint8Array.of(0x56, 0x63, 0x61, 0x66, 0xe9, 0x0a, 0x2e), 1).values, ["café"]);
  assert.deepEqual(readPickles(bytes("V\\\\u0041\n."), 1).values, ["\\\\u0041"]);
  assert.deepEqual(readPickles(bytes("V\\\\\\u0041\n."), 1).values, ["\\\\A"]);
  assert.deepEqual(readPickles(bytes("V\\x41\n."), 1).values, ["\\x41"]);
});

test("refuses text that isn't well formed", () => {
  // CPython reads a lone surrogate; AstroChart Bridge won't show one.
  assert.deepEqual(readPickles(bytes("V\\ud800\n."), 1), { kind: "refused", reason: "bad-text", index: 0, offset: 0 });
  assert.equal(readPickles(bytes("V\\u12\n."), 1).reason, "bad-text");
  assert.equal(readPickles(Uint8Array.of(0x80, 0x02, 0x58, 1, 0, 0, 0, 0xff, 0x2e), 1).reason, "bad-text");
});

// Opcodes that import, call, build or look up objects, by the bytes that use them.
const REFUSED = {
  GLOBAL: bytes("cbuiltins\nprint\n(S'x'\ntR."),
  STACK_GLOBAL: Uint8Array.of(0x80, 0x04, 0x8c, 1, 0x61, 0x8c, 1, 0x62, 0x93, 0x2e),
  REDUCE: bytes("R."),
  BUILD: bytes("b."),
  INST: bytes("ibuiltins\nlist\n."),
  NEWOBJ: Uint8Array.of(0x80, 0x02, 0x81, 0x2e),
  EXT1: Uint8Array.of(0x80, 0x02, 0x82, 1, 0x2e),
  PERSID: bytes("Px\n."),
  MARK: bytes("(lp0\n."),
  GET: bytes("g0\n."),
  BINGET: Uint8Array.of(0x80, 0x02, 0x68, 0, 0x2e),
  EMPTY_LIST: Uint8Array.of(0x80, 0x02, 0x5d, 0x2e),
  EMPTY_DICT: Uint8Array.of(0x80, 0x02, 0x7d, 0x2e),
  TUPLE1: Uint8Array.of(0x80, 0x02, 0x4e, 0x85, 0x2e),
  SHORT_BINBYTES: Uint8Array.of(0x80, 0x03, 0x43, 1, 0x61, 0x2e),
  LONG1: Uint8Array.of(0x80, 0x02, 0x8a, 1, 1, 0x2e),
};

for (const [opcode, pickle] of Object.entries(REFUSED)) {
  test(`refuses ${opcode}, naming it`, () => {
    const read = readPickles(pickle, 1);
    assert.equal(read.kind, "refused");
    assert.equal(read.reason, "unsupported-opcode");
    assert.equal(read.opcode, opcode);
    assert.equal(read.index, 0);
  });
}

test("says which pickle and byte an opcode was refused at", () => {
  const first = hex(CPYTHON[0][1][0]);
  assert.deepEqual(readPickles(concat(first, REFUSED.GLOBAL), 2), {
    kind: "refused",
    reason: "unsupported-opcode",
    opcode: "GLOBAL",
    index: 1,
    offset: first.length,
  });
});

test("refuses a file that stops early or runs on", () => {
  const two = concat(hex(CPYTHON[3][1][2]), hex(CPYTHON[6][1][2]));
  assert.deepEqual(readPickles(two, 3), { kind: "refused", reason: "truncated", index: 2 });
  assert.deepEqual(readPickles(two.slice(0, -1), 2), { kind: "refused", reason: "truncated", index: 1 });
  assert.deepEqual(readPickles(bytes("I123"), 1), { kind: "refused", reason: "truncated", index: 0 });
  assert.deepEqual(readPickles(two, 1), { kind: "refused", reason: "trailing-data", index: 1 });
  assert.deepEqual(readPickles(new Uint8Array(0), 1), { kind: "refused", reason: "truncated", index: 0 });
});

test("refuses a pickle that isn't one plain value", () => {
  const malformed = (pickle) => readPickles(pickle, 1).reason;
  // Nothing, or two values, before STOP.
  assert.equal(malformed(bytes(".")), "malformed");
  assert.equal(malformed(bytes("I1\nI2\n.")), "malformed");
  // PROTO after the start, or a protocol from the future.
  assert.equal(malformed(Uint8Array.of(0x4e, 0x80, 0x02, 0x2e)), "malformed");
  assert.equal(malformed(Uint8Array.of(0x80, 0x06, 0x4e, 0x2e)), "malformed");
  // Digits Python wouldn't write, and a string without its quotes.
  assert.equal(malformed(bytes("I1x\n.")), "malformed");
  assert.equal(malformed(bytes("I12345678901234567890\n.")), "malformed");
  assert.equal(malformed(bytes("Sabc\n.")), "malformed");
  assert.equal(malformed(Uint8Array.of(0x54, 0xff, 0xff, 0xff, 0xff, 0x2e)), "malformed");
});

test("ignores memo writes, since nothing reads the memo", () => {
  assert.deepEqual(readPickles(Uint8Array.of(0x80, 0x02, 0x88, 0x72, 0, 0, 0, 0, 0x2e), 1).values, [true]);
});
