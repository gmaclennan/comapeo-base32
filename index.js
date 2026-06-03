/**
 * Douglas Crockford's Base 32 encoding.
 *
 * Spec: https://www.crockford.com/base32.html
 *
 * Binary input is treated as a bit stream, read most-significant-bit first and
 * padded on the right per RFC 4648.
 *
 * Thanks to https://github.com/mafintosh/z32 for some performance techniques
 *
 * @module
 */

/** The 32 symbols. Excludes I, L, O, and U to avoid transcription mistakes. */
export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** The five extra symbols used only for the optional check value (32–36). */
const CHECK_EXTRA = '*~$=U'

/** Char codes of {@link ALPHABET}, indexed by 5-bit value. */
const ENCODE = new Uint8Array(32)
for (let i = 0; i < 32; i++) ENCODE[i] = ALPHABET.charCodeAt(i)

/**
 * Maps a char code (0–255) to its 5-bit value, or -1 if it is not a data
 * symbol. Folds in Crockford's decode forgiveness: lowercase is accepted, I/L
 * decode as 1, and O decodes as 0.
 */
const DECODE = buildDecodeTable(ALPHABET, false)

/**
 * Like {@link DECODE} but also accepts the five check-only symbols (values
 * 32–36). Used to read the trailing check character.
 */
const DECODE_CHECK = buildDecodeTable(ALPHABET + CHECK_EXTRA, true)

/**
 * @param {string} symbols
 * @param {boolean} check Whether `symbols` includes the check-only extras.
 * @returns {Int8Array}
 */
function buildDecodeTable(symbols, check) {
  const table = new Int8Array(256).fill(-1)
  for (let i = 0; i < symbols.length; i++) {
    const code = symbols.charCodeAt(i)
    table[code] = i
    // Accept the lowercase form of every letter.
    if (code >= 0x41 && code <= 0x5a) table[code + 0x20] = i
  }
  // Crockford's forgiving aliases.
  table[0x49] = table[0x69] = table['1'.charCodeAt(0)] // I, i -> 1
  table[0x4c] = table[0x6c] = table['1'.charCodeAt(0)] // L, l -> 1
  table[0x4f] = table[0x6f] = table['0'.charCodeAt(0)] // O, o -> 0
  // 'U'/'u' is a check-only symbol; it must stay invalid for data tables.
  if (!check) table[0x55] = table[0x75] = -1
  return table
}

export class InvalidCharacterError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message)
    this.name = 'InvalidCharacterError'
  }
}

export class InvalidChecksumCharacterError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message)
    this.name = 'InvalidChecksumCharacterError'
  }
}

export class InvalidChecksumError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message)
    this.name = 'InvalidChecksumError'
  }
}

const encoder = new TextEncoder()
// Output symbols are all ASCII, so UTF-8 decoding round-trips them 1:1.
const decoder = new TextDecoder()

/**
 * Encode bytes (or a UTF-8 string) to a Crockford Base 32 string.
 *
 * @param {Uint8Array | string} data
 * @param {{ checksum?: boolean }} [options] When `checksum` is true, append
 *   Crockford's check symbol (value mod 37).
 * @returns {string}
 */
export function encode(data, options) {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('Input must be a Uint8Array or string')
  }
  const len = bytes.length
  const out = new Uint8Array(Math.ceil((len * 8) / 5))

  let pi = 0
  let po = 0
  const blockEnd = len - (len % 5)

  // Fast path: 5 bytes (40 bits) -> 8 symbols, fully unrolled.
  for (; pi < blockEnd; pi += 5) {
    const b0 = bytes[pi]
    const b1 = bytes[pi + 1]
    const b2 = bytes[pi + 2]
    const b3 = bytes[pi + 3]
    const b4 = bytes[pi + 4]

    out[po++] = ENCODE[b0 >>> 3]
    out[po++] = ENCODE[((b0 & 0x07) << 2) | (b1 >>> 6)]
    out[po++] = ENCODE[(b1 >>> 1) & 0x1f]
    out[po++] = ENCODE[((b1 & 0x01) << 4) | (b2 >>> 4)]
    out[po++] = ENCODE[((b2 & 0x0f) << 1) | (b3 >>> 7)]
    out[po++] = ENCODE[(b3 >>> 2) & 0x1f]
    out[po++] = ENCODE[((b3 & 0x03) << 3) | (b4 >>> 5)]
    out[po++] = ENCODE[b4 & 0x1f]
  }

  // Tail: 1–4 bytes via a small bit accumulator. The leftover bits are padded
  // on the right, per Crockford. `acc` holds at most 32 significant bits here;
  // the final masked shift below may reach bit 35 but `& 0x1f` keeps it safe.
  if (pi < len) {
    let acc = 0
    let bits = 0
    for (; pi < len; pi++) {
      acc = (acc << 8) | bytes[pi]
      bits += 8
      while (bits >= 5) {
        bits -= 5
        out[po++] = ENCODE[(acc >>> bits) & 0x1f]
      }
    }
    // 1–4 tail bytes always leave 1–4 bits, so a final padded symbol is due.
    out[po++] = ENCODE[(acc << (5 - bits)) & 0x1f]
  }

  let result = decoder.decode(out)
  if (options && options.checksum) {
    result += (ALPHABET + CHECK_EXTRA)[checksum(bytes)]
  }
  return result
}

/**
 * Decode a Crockford Base 32 string to bytes.
 *
 * Input is normalized leniently: case is ignored, I/L decode as 1, O decodes
 * as 0, and hyphens are skipped.
 *
 * @param {string} input
 * @param {{ checksum?: boolean }} [options] When `checksum` is true, validate
 *   and strip the trailing check symbol.
 * @returns {Uint8Array}
 */
export function decode(input, options) {
  if (typeof input !== 'string') {
    throw new TypeError('Input must be a string')
  }
  // Hyphens are decorative and rare; only pay for stripping when present.
  if (input.indexOf('-') !== -1) input = input.replace(/-/g, '')

  if (options && options.checksum) {
    if (input.length === 0) {
      throw new InvalidChecksumCharacterError(
        'Cannot validate checksum: input is empty',
      )
    }
    const lastCode = input.charCodeAt(input.length - 1)
    const provided = lastCode < 256 ? DECODE_CHECK[lastCode] : -1
    if (provided < 0) {
      throw new InvalidChecksumCharacterError(
        `Invalid checksum character: ${input[input.length - 1]}`,
      )
    }
    const bytes = decodeBytes(input, input.length - 1)
    const computed = checksum(bytes)
    if (computed !== provided) {
      throw new InvalidChecksumError(
        `Checksum mismatch: expected '${(ALPHABET + CHECK_EXTRA)[computed]}' ` +
          `but found '${(ALPHABET + CHECK_EXTRA)[provided]}'`,
      )
    }
    return bytes
  }

  return decodeBytes(input, input.length)
}

/**
 * Validate that `input` is a Crockford Base 32 string with a correct trailing
 * check symbol. Returns false for any malformed input; never throws.
 *
 * @param {string} input
 * @returns {boolean}
 */
export function verify(input) {
  try {
    decode(input, { checksum: true })
    return true
  } catch {
    return false
  }
}

/**
 * @param {string} s
 * @param {number} end Decode characters in `[0, end)`.
 * @returns {Uint8Array}
 */
function decodeBytes(s, end) {
  const out = new Uint8Array(Math.ceil((end * 5) / 8))
  const blockEnd = end - (end % 8)

  let ps = 0
  let po = 0

  // Fast path: 8 symbols (40 bits) -> 5 bytes, fully unrolled.
  for (; ps < blockEnd; ps += 8) {
    const a = quintet(s, ps)
    const b = quintet(s, ps + 1)
    const c = quintet(s, ps + 2)
    const d = quintet(s, ps + 3)
    const e = quintet(s, ps + 4)
    const f = quintet(s, ps + 5)
    const g = quintet(s, ps + 6)
    const h = quintet(s, ps + 7)

    out[po++] = (a << 3) | (b >>> 2)
    out[po++] = ((b & 0x03) << 6) | (c << 1) | (d >>> 4)
    out[po++] = ((d & 0x0f) << 4) | (e >>> 1)
    out[po++] = ((e & 0x01) << 7) | (f << 2) | (g >>> 3)
    out[po++] = ((g & 0x07) << 5) | h
  }

  // Tail: 0–7 symbols. Emit whole bytes as they complete, then flush a final
  // partial byte when it carries data — either its bits are non-zero, or a
  // whole symbol went unpaired (>= 5 leftover bits) so it cannot be padding.
  let acc = 0
  let bits = 0
  for (; ps < end; ps++) {
    const v = quintet(s, ps)
    bits += 5
    if (bits >= 8) {
      bits -= 8
      out[po++] = acc | (v >>> bits)
      acc = (v << (8 - bits)) & 0xff
    } else {
      acc |= v << (8 - bits)
    }
  }
  if (acc > 0 || bits >= 5) out[po++] = acc

  // The estimate over-allocates by at most one byte, so the returned view may
  // be a slice of a slightly larger backing buffer (its trailing byte is zero).
  return po === out.length ? out : out.subarray(0, po)
}

/**
 * @param {string} s
 * @param {number} i
 * @returns {number} The 5-bit value of the character at `i`.
 */
function quintet(s, i) {
  const code = s.charCodeAt(i)
  const v = code < 256 ? DECODE[code] : -1
  if (v < 0) {
    throw new InvalidCharacterError(
      `Invalid base 32 character found in string: ${s[i]}`,
    )
  }
  return v
}

/**
 * Crockford's check value: the whole input interpreted as a big-endian integer,
 * mod 37. Folded byte-by-byte so no bigint is needed (`acc` stays < 37).
 *
 * @param {Uint8Array} bytes
 * @returns {number} A value in `[0, 37)`.
 */
function checksum(bytes) {
  let acc = 0
  for (let i = 0; i < bytes.length; i++) acc = (acc * 256 + bytes[i]) % 37
  return acc
}
