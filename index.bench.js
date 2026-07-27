import { bench, describe } from 'vitest'
import * as base32 from './index.js'
import * as z32 from 'z32'
import { base32 as rfc4648 } from 'rfc4648'
import {
  base32 as scureBase32,
  base32crockford as scureCrockford,
} from '@scure/base'
import baseX from 'base-x'

const zbase32 = baseX('ybndrfg8ejkmcpqxot1uwisza345h769')

// Libraries that require Node's `Buffer` load only where it exists, so the
// remaining benches also run in the browser projects.
const hasBuffer = typeof Buffer === 'function'
const CrockfordBase32 = hasBuffer
  ? (await import('crockford-base32')).CrockfordBase32
  : null
const legacyBase32 = hasBuffer ? (await import('base32')).default : null

// Deterministic input generation: a SHA-256 hash chain over a fixed seed
// (mafintosh's `random-bytes-seed` construction, on Web Crypto so it runs in
// Node and browsers alike). Every run measures identical inputs, with none of
// the statistical quirks of a hand-rolled PRNG.
let chainState = new TextEncoder().encode('@comapeo/base32 benchmark v1')

/** @param {number} n */
async function randomBytes(n) {
  const out = new Uint8Array(n)
  for (let used = 0; used < n; used += 32) {
    chainState = new Uint8Array(
      await globalThis.crypto.subtle.digest('SHA-256', chainState),
    )
    out.set(chainState.subarray(0, n - used), used)
  }
  // In Node, hand every library a `Buffer` (zero-copy), as their users would.
  return hasBuffer ? Buffer.from(out.buffer, 0, n) : out
}

/** @param {number} count */
async function makeFixedBuffers(count) {
  const buffers = []
  for (let i = 0; i < count; i++) buffers.push(await randomBytes(32))
  return buffers
}

/** @param {number} count */
async function makeMixedBuffers(count) {
  // Sizes in [0, 100], from two chain bytes (16-bit mod 101; bias ~0.1%).
  const sizeBytes = await randomBytes(2 * count)
  const buffers = []
  for (let i = 0; i < count; i++) {
    buffers.push(
      await randomBytes(((sizeBytes[2 * i] << 8) | sizeBytes[2 * i + 1]) % 101),
    )
  }
  return buffers
}

/**
 * Fixed 32-byte buffers (the typical "encoded ID" case) and mixed random
 * lengths of 0-100 bytes. One benchmark op = one pass over all 10,000.
 *
 * @type {[string, Uint8Array[]][]}
 */
const workloads = [
  ['32B', await makeFixedBuffers(1e4)],
  ['0-100B', await makeMixedBuffers(1e4)],
]

const opts = { time: 1000 }

for (const [w, buffers] of workloads) {
  describe(`encode ${w}`, () => {
    bench(
      '@comapeo/base32',
      () => {
        for (const buf of buffers) base32.encode(buf)
      },
      opts,
    )

    if (CrockfordBase32) {
      bench(
        'crockford-base32',
        () => {
          for (const buf of buffers) CrockfordBase32.encode(buf)
        },
        opts,
      )
    }

    bench(
      'z32',
      () => {
        for (const buf of buffers) z32.encode(buf)
      },
      opts,
    )

    if (legacyBase32) {
      bench(
        'base32',
        () => {
          for (const buf of buffers) legacyBase32.encode(buf)
        },
        opts,
      )
    }

    bench(
      'rfc4648',
      () => {
        for (const buf of buffers) rfc4648.stringify(buf)
      },
      opts,
    )

    bench(
      '@scure/base crockford',
      () => {
        for (const buf of buffers) scureCrockford.encode(buf)
      },
      opts,
    )

    bench(
      '@scure/base rfc4648',
      () => {
        for (const buf of buffers) scureBase32.encode(buf)
      },
      opts,
    )

    bench(
      'base-x z-base-32',
      () => {
        for (const buf of buffers) zbase32.encode(buf)
      },
      opts,
    )

    if (hasBuffer) {
      bench(
        'Buffer hex (not base32)',
        () => {
          for (const buf of buffers) buf.toString('hex')
        },
        opts,
      )
    }
  })
}

for (const [w, buffers] of workloads) {
  describe(`decode ${w}`, () => {
    const own = buffers.map((buf) => base32.encode(buf))
    bench(
      '@comapeo/base32',
      () => {
        for (const s of own) base32.decode(s)
      },
      opts,
    )

    if (CrockfordBase32) {
      const encoded = buffers.map((buf) => CrockfordBase32.encode(buf))
      bench(
        'crockford-base32',
        () => {
          for (const s of encoded) CrockfordBase32.decode(s)
        },
        opts,
      )
    }

    {
      const encoded = buffers.map((buf) => z32.encode(buf))
      bench(
        'z32',
        () => {
          for (const s of encoded) z32.decode(s)
        },
        opts,
      )
    }

    if (legacyBase32) {
      const lb32 = legacyBase32
      const encoded = buffers.map((buf) => lb32.encode(buf))
      bench(
        'base32',
        () => {
          for (const s of encoded) lb32.decode(s)
        },
        opts,
      )
    }

    {
      const encoded = buffers.map((buf) => rfc4648.stringify(buf))
      // Give rfc4648 its fastest documented output option where available.
      const parseOpts = hasBuffer ? { out: Buffer.allocUnsafe } : {}
      bench(
        'rfc4648',
        () => {
          for (const s of encoded) rfc4648.parse(s, parseOpts)
        },
        opts,
      )
    }

    {
      const encoded = buffers.map((buf) => scureCrockford.encode(buf))
      bench(
        '@scure/base crockford',
        () => {
          for (const s of encoded) scureCrockford.decode(s)
        },
        opts,
      )
    }

    {
      const encoded = buffers.map((buf) => scureBase32.encode(buf))
      bench(
        '@scure/base rfc4648',
        () => {
          for (const s of encoded) scureBase32.decode(s)
        },
        opts,
      )
    }

    {
      const encoded = buffers.map((buf) => zbase32.encode(buf))
      bench(
        'base-x z-base-32',
        () => {
          for (const s of encoded) zbase32.decode(s)
        },
        opts,
      )
    }

    if (hasBuffer) {
      const encoded = buffers.map((buf) => Buffer.from(buf).toString('hex'))
      bench(
        'Buffer hex (not base32)',
        () => {
          for (const s of encoded) Buffer.from(s, 'hex')
        },
        opts,
      )
    }
  })
}
