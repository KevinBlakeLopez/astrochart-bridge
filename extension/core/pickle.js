// Reads a file made of Python pickles that each hold one plain value: a str,
// int, float, bool or None. Morinus saves a chart this way (core/morinus-hor.js).
//
// Python's own pickle.load would build whatever objects a file names, and run
// the functions it names while doing so, so opening a crafted file with it can
// run any code. This reads the opcodes itself and knows only those that push
// one plain value, write the memo, or mark the protocol and its frames. Every
// other opcode is refused by name and byte offset: above all those that import
// or call Python (GLOBAL, STACK_GLOBAL, REDUCE, BUILD, INST, OBJ, NEWOBJ), but
// also containers and memo reads, which no plain value needs. Nothing in a
// file is ever run, and nothing it names is looked up.

const refused = (reason, index, extra = {}) => ({ kind: "refused", reason, index, ...extra });

// Opcodes by byte, named as Python's pickletools names them, so a refusal says which.
const NAMES = {
  0x28: "MARK", 0x2e: "STOP", 0x30: "POP", 0x31: "POP_MARK", 0x32: "DUP", 0x46: "FLOAT", 0x49: "INT",
  0x4a: "BININT", 0x4b: "BININT1", 0x4c: "LONG", 0x4d: "BININT2", 0x4e: "NONE", 0x50: "PERSID",
  0x51: "BINPERSID", 0x52: "REDUCE", 0x53: "STRING", 0x54: "BINSTRING", 0x55: "SHORT_BINSTRING",
  0x56: "UNICODE", 0x58: "BINUNICODE", 0x61: "APPEND", 0x62: "BUILD", 0x63: "GLOBAL", 0x64: "DICT",
  0x7d: "EMPTY_DICT", 0x65: "APPENDS", 0x67: "GET", 0x68: "BINGET", 0x69: "INST", 0x6a: "LONG_BINGET",
  0x6c: "LIST", 0x5d: "EMPTY_LIST", 0x6f: "OBJ", 0x70: "PUT", 0x71: "BINPUT", 0x72: "LONG_BINPUT",
  0x73: "SETITEM", 0x74: "TUPLE", 0x29: "EMPTY_TUPLE", 0x75: "SETITEMS", 0x47: "BINFLOAT",
  0x80: "PROTO", 0x81: "NEWOBJ", 0x82: "EXT1", 0x83: "EXT2", 0x84: "EXT4", 0x85: "TUPLE1", 0x86: "TUPLE2",
  0x87: "TUPLE3", 0x88: "NEWTRUE", 0x89: "NEWFALSE", 0x8a: "LONG1", 0x8b: "LONG4", 0x42: "BINBYTES",
  0x43: "SHORT_BINBYTES", 0x8c: "SHORT_BINUNICODE", 0x8d: "BINUNICODE8", 0x8e: "BINBYTES8",
  0x8f: "EMPTY_SET", 0x90: "ADDITEMS", 0x91: "FROZENSET", 0x92: "NEWOBJ_EX", 0x93: "STACK_GLOBAL",
  0x94: "MEMOIZE", 0x95: "FRAME", 0x96: "BYTEARRAY8", 0x97: "NEXT_BUFFER", 0x98: "READONLY_BUFFER",
};

// The binary opcodes protocol 1 brought in. A pickle without PROTO that uses
// one was written with protocol 1; one with only text opcodes, with protocol 0.
const PROTOCOL_1 = new Set([0x4a, 0x4b, 0x4d, 0x47, 0x58, 0x54, 0x55, 0x71, 0x72]);

// The newest protocol Python writes, as of 3.14.
const HIGHEST_PROTOCOL = 5;

// Fifteen digits stay exact as a JavaScript number; no plain value needs more.
const INT_DIGITS = /^[+-]?\d{1,15}$/;
const LONG_DIGITS = /^[+-]?\d{1,15}L?$/;
// FLOAT's text, as Python's repr writes it, with inf and nan.
const FLOAT_TEXT = /^[+-]?(?:\d+\.?\d*(?:e[+-]?\d+)?|inf|nan)$/i;

/**
 * The values of exactly count pickles, one after another and nothing after
 * them, or why they can't be read. A Python 2 byte string names no code page:
 * one that isn't ASCII is read as Windows-1252, and guessedText says so.
 *
 * @param {Uint8Array} bytes
 * @param {number} count
 * @returns {{ kind: "pickles", values: (string | number | boolean | null)[], protocol: number, guessedText: boolean }
 *   | { kind: "refused", reason: "truncated" | "trailing-data" | "unsupported-opcode" | "malformed" | "bad-text",
 *       index: number, opcode?: string, offset?: number }}
 *   protocol is the newest the pickles were written with; index counts the
 *   pickles from 0, and offset the bytes
 */
export function readPickles(bytes, count) {
  const values = [];
  let protocol = 0;
  let guessedText = false;
  let at = 0;
  for (let index = 0; index < count; index += 1) {
    const pickle = readPickle(bytes, at);
    if (pickle.kind === "refused") return { ...pickle, index };
    values.push(pickle.value);
    protocol = Math.max(protocol, pickle.protocol);
    guessedText ||= pickle.guessedText;
    at = pickle.end;
  }
  if (at !== bytes.length) return refused("trailing-data", count);
  return { kind: "pickles", values, protocol, guessedText };
}

const TRUNCATED = Object.freeze({ kind: "refused", reason: "truncated" });

// One pickle from start: the one value it pushes, and where it ends.
function readPickle(bytes, start) {
  let at = start;
  let protocol = 0;
  let guessedText = false;
  const stack = [];
  // The next n bytes, or the rest of the line without its newline; null past the end.
  const take = (n) => {
    if (at + n > bytes.length) return null;
    at += n;
    return bytes.subarray(at - n, at);
  };
  const line = () => {
    const end = bytes.indexOf(0x0a, at);
    if (end === -1) return null;
    const part = bytes.subarray(at, end);
    at = end + 1;
    return part;
  };
  const view = (part) => new DataView(part.buffer, part.byteOffset, part.byteLength);
  const byteString = (part) => {
    if (part.every((byte) => byte < 0x80)) return ascii(part);
    guessedText = true;
    return new TextDecoder("windows-1252").decode(part);
  };

  for (;;) {
    const offset = at;
    if (at >= bytes.length) return TRUNCATED;
    const op = bytes[at];
    at += 1;
    if (PROTOCOL_1.has(op)) protocol = Math.max(protocol, 1);
    const malformed = { kind: "refused", reason: "malformed", offset };
    let part;
    let value;

    switch (op) {
      // Markers, which push nothing.
      case 0x80: // PROTO, only at the start
        if ((part = take(1)) === null) return TRUNCATED;
        if (offset !== start || part[0] > HIGHEST_PROTOCOL) return malformed;
        protocol = part[0];
        continue;
      case 0x95: // FRAME: the length of what follows, which changes nothing here
        if (take(8) === null) return TRUNCATED;
        continue;
      // The memo: written, never read, since no GET is accepted.
      case 0x70: // PUT
        if (line() === null) return TRUNCATED;
        continue;
      case 0x71: // BINPUT
        if (take(1) === null) return TRUNCATED;
        continue;
      case 0x72: // LONG_BINPUT
        if (take(4) === null) return TRUNCATED;
        continue;
      case 0x94: // MEMOIZE
        continue;
      case 0x2e: // STOP
        if (stack.length !== 1) return malformed;
        return { kind: "value", value: stack[0], end: at, protocol, guessedText };

      // Every other opcode accepted pushes one value.
      case 0x49: { // INT, where "01" and "00" are protocol 0's True and False
        if ((part = line()) === null) return TRUNCATED;
        const digits = ascii(part);
        if (digits === "01" || digits === "00") value = digits === "01";
        else if (INT_DIGITS.test(digits)) value = Number(digits);
        else return malformed;
        break;
      }
      case 0x4c: { // LONG, as Python 2 writes it: "5L"
        if ((part = line()) === null) return TRUNCATED;
        const digits = ascii(part);
        if (!LONG_DIGITS.test(digits)) return malformed;
        value = Number(digits.replace(/L$/, ""));
        break;
      }
      case 0x4a: // BININT
        if ((part = take(4)) === null) return TRUNCATED;
        value = view(part).getInt32(0, true);
        break;
      case 0x4b: // BININT1
        if ((part = take(1)) === null) return TRUNCATED;
        value = part[0];
        break;
      case 0x4d: // BININT2
        if ((part = take(2)) === null) return TRUNCATED;
        value = view(part).getUint16(0, true);
        break;
      case 0x88: // NEWTRUE
        value = true;
        break;
      case 0x89: // NEWFALSE
        value = false;
        break;
      case 0x4e: // NONE
        value = null;
        break;
      case 0x46: { // FLOAT
        if ((part = line()) === null) return TRUNCATED;
        const text = ascii(part);
        if (!FLOAT_TEXT.test(text)) return malformed;
        value = Number(text.replace(/^([+-]?)inf$/i, "$1Infinity").replace(/^[+-]?nan$/i, "NaN"));
        break;
      }
      case 0x47: // BINFLOAT, big-endian
        if ((part = take(8)) === null) return TRUNCATED;
        value = view(part).getFloat64(0, false);
        break;
      case 0x56: // UNICODE: raw-unicode-escape to the end of the line
        if ((part = line()) === null) return TRUNCATED;
        value = rawUnicodeEscape(part);
        break;
      case 0x58: // BINUNICODE: UTF-8 after a 4-byte length
      case 0x8c: { // SHORT_BINUNICODE: after a 1-byte length
        const size = take(op === 0x58 ? 4 : 1);
        if (size === null) return TRUNCATED;
        if ((part = take(op === 0x58 ? view(size).getUint32(0, true) : size[0])) === null) return TRUNCATED;
        value = utf8(part);
        break;
      }
      case 0x53: { // STRING: a Python 2 byte string, quoted as repr writes it
        if ((part = line()) === null) return TRUNCATED;
        const raw = unquoted(ascii(part));
        if (raw === null) return malformed;
        value = byteString(raw);
        break;
      }
      case 0x54: // BINSTRING: a byte string after a signed 4-byte length
      case 0x55: { // SHORT_BINSTRING: after a 1-byte length
        const size = take(op === 0x54 ? 4 : 1);
        if (size === null) return TRUNCATED;
        const length = op === 0x54 ? view(size).getInt32(0, true) : size[0];
        if (length < 0) return malformed;
        if ((part = take(length)) === null) return TRUNCATED;
        value = byteString(part);
        break;
      }
      default:
        return { kind: "refused", reason: "unsupported-opcode", opcode: NAMES[op] ?? `0x${op.toString(16)}`, offset };
    }
    if (value === undefined) return { kind: "refused", reason: "bad-text", offset };
    stack.push(value);
  }
}

const ascii = (part) => String.fromCharCode(...part);

// undefined when the bytes aren't UTF-8, or hold a lone surrogate, which
// Python writes with surrogatepass.
function utf8(part) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(part);
  } catch {
    return undefined;
  }
}

// Python's raw-unicode-escape: each byte is the character of that number,
// except \uXXXX and \UXXXXXXXX after an odd run of backslashes. Pickle writes
// a backslash itself as \ and a newline as \u000a. undefined for a broken
// escape, or a lone surrogate, which Python reads but a page can't show.
function rawUnicodeEscape(part) {
  let out = "";
  let i = 0;
  while (i < part.length) {
    if (part[i] !== 0x5c) {
      out += String.fromCharCode(part[i]);
      i += 1;
      continue;
    }
    let j = i;
    while (part[j] === 0x5c) j += 1;
    const run = j - i;
    const width = part[j] === 0x75 ? 4 : part[j] === 0x55 ? 8 : 0;
    if (run % 2 === 0 || width === 0) {
      out += "\\".repeat(run);
      i = j;
      continue;
    }
    const digits = ascii(part.subarray(j + 1, j + 1 + width));
    if (!/^[0-9a-fA-F]+$/.test(digits) || digits.length !== width) return undefined;
    const point = parseInt(digits, 16);
    if (point > 0x10ffff) return undefined;
    out += "\\".repeat(run - 1) + String.fromCodePoint(point);
    i = j + 1 + width;
  }
  return out.isWellFormed() ? out : undefined;
}

const ESCAPES = { "\\": 0x5c, "'": 0x27, '"': 0x22, n: 0x0a, r: 0x0d, t: 0x09, a: 0x07, b: 0x08, f: 0x0c, v: 0x0b };

// The bytes of a byte string quoted as Python's repr writes it, or null.
function unquoted(literal) {
  const quote = literal[0];
  if ((quote !== "'" && quote !== '"') || literal.length < 2 || literal.at(-1) !== quote) return null;
  const body = literal.slice(1, -1);
  const out = [];
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] !== "\\") {
      out.push(body.charCodeAt(i));
      continue;
    }
    const next = body[i + 1];
    const octal = /^[0-7]{1,3}/.exec(body.slice(i + 1));
    if (next === undefined) return null;
    if (Object.hasOwn(ESCAPES, next)) {
      out.push(ESCAPES[next]);
      i += 1;
    } else if (next === "x" && /^[0-9a-fA-F]{2}$/.test(body.slice(i + 2, i + 4))) {
      out.push(parseInt(body.slice(i + 2, i + 4), 16));
      i += 3;
    } else if (octal) {
      out.push(parseInt(octal[0], 8) & 0xff);
      i += octal[0].length;
    } else {
      // Python keeps an escape it doesn't know as written.
      out.push(0x5c);
    }
  }
  return Uint8Array.from(out);
}
