import { describe, it, expect } from 'vitest'
import {
  encode,
  decode,
  verify,
  ALPHABET,
  InvalidCharacterError,
  InvalidChecksumCharacterError,
  InvalidChecksumError,
} from './index.js'

/** @param {Uint8Array} u */
const hex = (u) =>
  Array.from(u, (b) => b.toString(16).padStart(2, '0')).join('')

/** @param {string} h */
const bytes = (h) => {
  const u = new Uint8Array(h.length / 2)
  for (let i = 0; i < u.length; i++)
    u[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  return u
}

/** @param {string} s */
const utf8 = (s) => new TextEncoder().encode(s)
/** @param {Uint8Array} u */
const str = (u) => new TextDecoder().decode(u)

/** @param {number} n */
const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n))

/**
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 */
const equal = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

describe('encode', () => {
  it('encodes a multiple of 5 bytes', () => {
    expect(encode(bytes('a6e563345f'))).toBe('MVJP6D2Z')
  })

  it('encodes a single byte', () => {
    expect(encode(bytes('74'))).toBe('EG')
  })

  it('encodes two bytes', () => {
    expect(encode(bytes('7474'))).toBe('EHT0')
  })

  it('encodes three bytes', () => {
    expect(encode(bytes('0000a9'))).toBe('000AJ')
  })

  it('encodes four bytes', () => {
    // exercises the 4-byte tail branch (7 output chars)
    expect(equal(decode(encode(bytes('deadbeef'))), bytes('deadbeef'))).toBe(
      true,
    )
  })

  it('encodes a large value', () => {
    expect(encode(bytes('593f8759e8431f5f'))).toBe('B4ZREPF88CFNY')
  })

  it('does not strip leading zeros', () => {
    expect(encode(Uint8Array.from([0, 0, 0xa9]))).toBe('000AJ')
  })

  it('encodes a UUID', () => {
    expect(encode(bytes('017cb3b93bcb40b6147d7813c5ad2339'))).toBe(
      '05YB7E9VSD0BC53XF09WBB9374',
    )
  })

  it('encodes an empty input to an empty string', () => {
    expect(encode(new Uint8Array(0))).toBe('')
  })

  it('accepts a UTF-8 string', () => {
    expect(encode('test')).toBe('EHJQ6X0')
    expect(encode('some string')).toBe('EDQPTS90EDT74TBECW')
  })

  it('does not modify the input array', () => {
    const input = utf8('test')
    const copy = input.slice()
    encode(input)
    expect(equal(input, copy)).toBe(true)
  })

  it('only uses alphabet characters', () => {
    for (let i = 0; i < 200; i++) {
      const s = encode(randomBytes(Math.round(Math.random() * 100)))
      for (const ch of s) expect(ALPHABET).toContain(ch)
    }
  })

  it.each([42, [0], null, undefined, {}])(
    'throws TypeError for non-Uint8Array, non-string input (%s)',
    (input) => {
      // @ts-expect-error - exercising a runtime guard against bad input
      expect(() => encode(input)).toThrow(TypeError)
    },
  )
})

describe('decode', () => {
  it('decodes a multiple of 5 bits', () => {
    expect(hex(decode('MVJP6D2Z'))).toBe('a6e563345f')
  })

  it('decodes a single byte', () => {
    expect(str(decode('EG'))).toBe('t')
  })

  it('decodes two bytes', () => {
    expect(str(decode('EHT0'))).toBe('tt')
  })

  it('decodes a large value', () => {
    expect(hex(decode('B4ZREPF88CFNY'))).toBe('593f8759e8431f5f')
  })

  it('keeps leading zeros', () => {
    expect(hex(decode('000AJ'))).toBe('0000a9')
  })

  it('decodes an empty string to empty bytes', () => {
    expect(decode('').length).toBe(0)
  })

  it('decodes a single zero character to a zero byte', () => {
    expect(hex(decode('0'))).toBe('00')
  })

  it('decodes a single non-zero character to a padded byte', () => {
    expect(hex(decode('1'))).toBe('08')
  })

  it('does not add up to a complete byte', () => {
    expect(hex(decode('A1M'))).toBe('5068')
  })

  it('preserves non-zero trailing bits in non-canonical input', () => {
    expect(hex(decode('01'))).toBe('0040')
  })

  it('flushes a trailing zero byte for all-zero non-canonical input', () => {
    expect(hex(decode('000'))).toBe('0000')
  })

  it.each([
    ['I', 'AIm0', '5068'],
    ['i', 'Aim0', '5068'],
    ['L', 'ALm0', '5068'],
    ['l', 'Alm0', '5068'],
    ['O', 'AOM0', '5028'],
    ['o', 'AoM0', '5028'],
  ])('translates %s when decoding', (_char, input, output) => {
    expect(hex(decode(input))).toBe(output)
  })

  it('ignores case', () => {
    expect(hex(decode('mvjp6d2z'))).toBe('a6e563345f')
  })

  it('ignores hyphens', () => {
    expect(str(decode('EDQPTS-90EDT7-4TBECW'))).toBe('some string')
  })

  it('ignores multiple adjacent hyphens', () => {
    expect(str(decode('EDQPTS--90EDT7---4TBECW'))).toBe('some string')
  })

  it('throws on an invalid character', () => {
    expect(() => decode('T&ZQ')).toThrow(InvalidCharacterError)
    expect(() => decode('T&ZQ')).toThrow(
      'Invalid base 32 character found in string: &',
    )
  })

  it('rejects U as a data character', () => {
    expect(() => decode('UA0')).toThrow(InvalidCharacterError)
  })

  it('rejects characters outside the latin1 range', () => {
    expect(() => decode('👀')).toThrow(InvalidCharacterError)
  })

  it.each([123, null, undefined, {}])(
    'throws TypeError for non-string input (%s)',
    (input) => {
      // @ts-expect-error - exercising a runtime guard against bad input
      expect(() => decode(input)).toThrow(TypeError)
    },
  )
})

describe('round-trip', () => {
  it('round-trips 50k random buffers', () => {
    for (let i = 0; i < 50_000; i++) {
      const b = randomBytes(Math.round(Math.random() * 100))
      expect(equal(decode(encode(b)), b)).toBe(true)
    }
  })

  it('round-trips a string with multi-byte characters', () => {
    const s = 'The quick brown fox jumps over the lazy dog. 👀'
    expect(str(decode(encode(s)))).toBe(s)
  })
})

describe('checksum', () => {
  it('appends a single check symbol', () => {
    // 0xff = 255, encoded as 'ZW'; 255 % 37 = 33 -> '~'
    expect(encode(bytes('ff'), { checksum: true })).toBe('ZW~')
  })

  it('computes the checksum from the value, not the encoded chars', () => {
    expect(encode(bytes('a6e563345f'), { checksum: true })).toBe('MVJP6D2ZV')
  })

  it('produces a "0" check symbol for empty input', () => {
    expect(encode(new Uint8Array(0), { checksum: true })).toBe('0')
  })

  it.each([
    [0x20, '*'],
    [0x21, '~'],
    [0x22, '$'],
    [0x23, '='],
    [0x24, 'U'],
  ])('produces extended check character %s', (byte, char) => {
    const result = encode(Uint8Array.from([byte]), { checksum: true })
    expect(result.at(-1)).toBe(char)
  })

  it('does not append a checksum when the option is false', () => {
    expect(encode(bytes('ff'), { checksum: false })).toBe('ZW')
  })

  it('round-trips a single byte', () => {
    expect(hex(decode('ZW~', { checksum: true }))).toBe('ff')
  })

  it('decodes a multi-byte value with checksum', () => {
    expect(hex(decode('MVJP6D2ZV', { checksum: true }))).toBe('a6e563345f')
  })

  it('decodes a value with leading zeros', () => {
    // 0x0000a9 -> '000AJ', checksum 0xa9 % 37 = 21 -> 'N'
    expect(hex(decode('000AJN', { checksum: true }))).toBe('0000a9')
  })

  it('decodes "0" (empty data + zero checksum) to empty bytes', () => {
    expect(decode('0', { checksum: true }).length).toBe(0)
  })

  it('strips hyphens before validating the checksum', () => {
    expect(str(decode('EHJQ6X-0V', { checksum: true }))).toBe('test')
  })

  it('accepts a lowercase check symbol', () => {
    // 0x24 encodes to '4GU'; lowercase 'u' normalizes to 'U'
    expect(hex(decode('4Gu', { checksum: true }))).toBe('24')
  })

  it.each([
    ['04I', '01'],
    ['04L', '01'],
  ])('auto-corrects I/L to 1 in the check position (%s)', (input, out) => {
    expect(hex(decode(input, { checksum: true }))).toBe(out)
  })

  it('auto-corrects O to 0 in the check position', () => {
    expect(decode('O', { checksum: true }).length).toBe(0)
  })

  it('still applies I/L/O substitution to the data portion', () => {
    expect(hex(decode('AIm0C', { checksum: true }))).toBe('5068')
  })

  it.each([0x20, 0x21, 0x22, 0x23, 0x24])(
    'round-trips extended check character for byte %s',
    (byte) => {
      const encoded = encode(Uint8Array.from([byte]), { checksum: true })
      expect(hex(decode(encoded, { checksum: true }))).toBe(
        byte.toString(16).padStart(2, '0'),
      )
    },
  )

  it('throws InvalidChecksumCharacterError on empty input', () => {
    expect(() => decode('', { checksum: true })).toThrow(
      InvalidChecksumCharacterError,
    )
  })

  it('throws InvalidChecksumCharacterError on an invalid trailing character', () => {
    expect(() => decode('ZW!', { checksum: true })).toThrow(
      InvalidChecksumCharacterError,
    )
  })

  it('throws InvalidChecksumCharacterError on a non-latin1 trailing character', () => {
    expect(() => decode('A👀', { checksum: true })).toThrow(
      InvalidChecksumCharacterError,
    )
  })

  it('throws InvalidChecksumError on a mismatched checksum', () => {
    expect(() => decode('ZW0', { checksum: true })).toThrow(
      InvalidChecksumError,
    )
  })

  it('rejects U in the data portion when checksum is enabled', () => {
    expect(() => decode('UA0', { checksum: true })).toThrow(
      InvalidCharacterError,
    )
  })

  it('does not validate a checksum when the option is omitted', () => {
    expect(() => decode('ZW~')).toThrow(InvalidCharacterError)
  })

  it('exports error classes that extend Error with proper names', () => {
    const charErr = new InvalidChecksumCharacterError('m')
    const sumErr = new InvalidChecksumError('m')
    const dataErr = new InvalidCharacterError('m')
    expect(charErr).toBeInstanceOf(Error)
    expect(sumErr).toBeInstanceOf(Error)
    expect(dataErr).toBeInstanceOf(Error)
    expect(charErr.name).toBe('InvalidChecksumCharacterError')
    expect(sumErr.name).toBe('InvalidChecksumError')
    expect(dataErr.name).toBe('InvalidCharacterError')
  })
})

describe('verify', () => {
  it('returns true for a valid checksummed string', () => {
    expect(verify('ZW~')).toBe(true)
    expect(verify('MVJP6D2ZV')).toBe(true)
  })

  it('returns true for a checksummed string with hyphens', () => {
    expect(verify('EHJQ6X-0V')).toBe(true)
  })

  it('returns true for lowercase input', () => {
    expect(verify('mvjp6d2zv')).toBe(true)
  })

  it.each(['04I', '04L', 'O'])(
    'returns true with auto-correction (%s)',
    (s) => {
      expect(verify(s)).toBe(true)
    },
  )

  it('returns true for an encode round-trip', () => {
    expect(verify(encode('test', { checksum: true }))).toBe(true)
  })

  it('returns false for empty input', () => {
    expect(verify('')).toBe(false)
  })

  it('returns false for an invalid check character', () => {
    expect(verify('ZW!')).toBe(false)
  })

  it('returns false for a mismatched checksum', () => {
    expect(verify('ZW0')).toBe(false)
  })

  it('returns false for an invalid data character', () => {
    expect(verify('UAX')).toBe(false)
  })

  it('verifies large random round-trips', () => {
    for (let i = 0; i < 1000; i++) {
      const encoded = encode(randomBytes(Math.round(Math.random() * 60)), {
        checksum: true,
      })
      expect(verify(encoded)).toBe(true)
    }
  })
})

describe('large inputs', () => {
  it('round-trips a 20k-byte buffer', () => {
    const big = randomBytes(20_000)
    expect(equal(decode(encode(big)), big)).toBe(true)
  })
})
