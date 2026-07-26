import bench from 'nanobench'
import { readFileSync } from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { fileURLToPath } from 'node:url'
import * as base32 from './index.js'
import { CrockfordBase32 } from 'crockford-base32'
import * as z32 from 'z32'
import legacyBase32 from 'base32'
import { base32 as rfc4648 } from 'rfc4648'
import {
  base32 as scureBase32,
  base32crockford as scureCrockford,
} from '@scure/base'
import baseX from 'base-x'

const zbase32 = baseX('ybndrfg8ejkmcpqxot1uwisza345h769')

// `@scure/base-next` is the unreleased upstream `main`, installed straight from
// git, so it ships only `index.ts` with no build step. Node can strip the types
// but refuses to do so for files under `node_modules`, so apply Node's own
// stripper by hand. This costs ~55 ms once at import; nothing is measured until
// after every module has loaded, so it does not affect any timing below.
registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith('.ts')) return nextLoad(url, context)
    const source = readFileSync(fileURLToPath(url), 'utf8')
    return {
      format: 'module',
      shortCircuit: true,
      source: stripTypeScriptTypes(source, { mode: 'strip', sourceUrl: url }),
    }
  },
})

/** Null when unavailable, e.g. on a Node without type stripping. */
let scureNext = null
try {
  scureNext = await import('@scure/base-next/index.ts')
} catch (err) {
  console.error(`# skipping unreleased @scure/base: ${err.message}`)
}

// Seeded PRNG (xorshift32) so every run measures identical inputs and results
// are comparable across runs and machines.
let seed = 0x2c0ffee1
function rnd() {
  seed ^= seed << 13
  seed ^= seed >>> 17
  seed ^= seed << 5
  seed >>>= 0
  return seed / 0x100000000
}

/** @param {number} n */
function randomBytes(n) {
  const buf = Buffer.allocUnsafe(n)
  for (let i = 0; i < n; i++) buf[i] = (rnd() * 256) | 0
  return buf
}

/**
 * Two workloads, 10,000 buffers each: fixed 32-byte buffers (the typical
 * "encoded ID" case) and mixed random lengths of 0-100 bytes.
 *
 * @type {[string, Buffer[]][]}
 */
const workloads = [
  ['32B', Array.from({ length: 1e4 }, () => randomBytes(32))],
  [
    '0-100B',
    Array.from({ length: 1e4 }, () => randomBytes(Math.round(rnd() * 100))),
  ],
]

for (const [w, buffers] of workloads) {
  bench(`@comapeo/base32 encode ${w} 100 times`, (b) => {
    b.start()
    for (let i = 0; i < 100; i++) for (const buf of buffers) base32.encode(buf)
    b.end()
  })
}

for (const [w, buffers] of workloads) {
  bench(`crockford-base32 encode ${w} 100 times`, (b) => {
    b.start()
    for (let i = 0; i < 100; i++)
      for (const buf of buffers) CrockfordBase32.encode(buf)
    b.end()
  })
}

for (const [w, buffers] of workloads) {
  bench(`z32 encode ${w} 100 times`, (b) => {
    b.start()
    for (let i = 0; i < 100; i++) for (const buf of buffers) z32.encode(buf)
    b.end()
  })
}

for (const [w, buffers] of workloads) {
  bench(`base32 encode ${w} 100 times`, (b) => {
    b.start()
    for (let i = 0; i < 100; i++)
      for (const buf of buffers) legacyBase32.encode(buf)
    b.end()
  })
}

for (const [w, buffers] of workloads) {
  bench(`rfc4648 base32 encode ${w} 100 times`, (b) => {
    b.start()
    for (let i = 0; i < 100; i++)
      for (const buf of buffers) rfc4648.stringify(buf)
    b.end()
  })
}

for (const [w, buffers] of workloads) {
  bench(`@scure/base crockford encode ${w} 100 times`, (b) => {
    b.start()
    for (let i = 0; i < 100; i++)
      for (const buf of buffers) scureCrockford.encode(buf)
    b.end()
  })
}

for (const [w, buffers] of workloads) {
  bench(`@scure/base rfc4648 base32 encode ${w} 100 times`, (b) => {
    b.start()
    for (let i = 0; i < 100; i++)
      for (const buf of buffers) scureBase32.encode(buf)
    b.end()
  })
}

if (scureNext) {
  for (const [w, buffers] of workloads) {
    bench(`@scure/base unreleased crockford encode ${w} 100 times`, (b) => {
      b.start()
      for (let i = 0; i < 100; i++)
        for (const buf of buffers) scureNext.base32crockford.encode(buf)
      b.end()
    })
  }

  for (const [w, buffers] of workloads) {
    bench(
      `@scure/base unreleased rfc4648 base32 encode ${w} 100 times`,
      (b) => {
        b.start()
        for (let i = 0; i < 100; i++)
          for (const buf of buffers) scureNext.base32.encode(buf)
        b.end()
      },
    )
  }
}

for (const [w, buffers] of workloads) {
  bench(`base-x z-base-32 encode ${w} 100 times`, (b) => {
    b.start()
    for (let i = 0; i < 100; i++) for (const buf of buffers) zbase32.encode(buf)
    b.end()
  })
}

for (const [w, buffers] of workloads) {
  bench(`buf.toString('hex') encode ${w} 100 times`, (b) => {
    b.start()
    for (let i = 0; i < 100; i++) for (const buf of buffers) buf.toString('hex')
    b.end()
  })
}

for (const [w, buffers] of workloads) {
  bench(`@comapeo/base32 decode ${w} 100 times`, (b) => {
    const encoded = buffers.map((buf) => base32.encode(buf))
    b.start()
    for (let i = 0; i < 100; i++) for (const s of encoded) base32.decode(s)
    b.end()
  })
}

for (const [w, buffers] of workloads) {
  bench(`crockford-base32 decode ${w} 100 times`, (b) => {
    const encoded = buffers.map((buf) => CrockfordBase32.encode(buf))
    b.start()
    for (let i = 0; i < 100; i++)
      for (const s of encoded) CrockfordBase32.decode(s)
    b.end()
  })
}

for (const [w, buffers] of workloads) {
  bench(`z32 decode ${w} 100 times`, (b) => {
    const encoded = buffers.map((buf) => z32.encode(buf))
    b.start()
    for (let i = 0; i < 100; i++) for (const s of encoded) z32.decode(s)
    b.end()
  })
}

for (const [w, buffers] of workloads) {
  bench(`base32 decode ${w} 100 times`, (b) => {
    const encoded = buffers.map((buf) => legacyBase32.encode(buf))
    b.start()
    for (let i = 0; i < 100; i++)
      for (const s of encoded) legacyBase32.decode(s)
    b.end()
  })
}

for (const [w, buffers] of workloads) {
  bench(`rfc4648 base32 decode ${w} 100 times`, (b) => {
    const encoded = buffers.map((buf) => rfc4648.stringify(buf))
    b.start()
    for (let i = 0; i < 100; i++)
      for (const s of encoded) rfc4648.parse(s, { out: Buffer.allocUnsafe })
    b.end()
  })
}

for (const [w, buffers] of workloads) {
  bench(`@scure/base crockford decode ${w} 100 times`, (b) => {
    const encoded = buffers.map((buf) => scureCrockford.encode(buf))
    b.start()
    for (let i = 0; i < 100; i++)
      for (const s of encoded) scureCrockford.decode(s)
    b.end()
  })
}

for (const [w, buffers] of workloads) {
  bench(`@scure/base rfc4648 base32 decode ${w} 100 times`, (b) => {
    const encoded = buffers.map((buf) => scureBase32.encode(buf))
    b.start()
    for (let i = 0; i < 100; i++) for (const s of encoded) scureBase32.decode(s)
    b.end()
  })
}

if (scureNext) {
  for (const [w, buffers] of workloads) {
    bench(`@scure/base unreleased crockford decode ${w} 100 times`, (b) => {
      const encoded = buffers.map((buf) =>
        scureNext.base32crockford.encode(buf),
      )
      b.start()
      for (let i = 0; i < 100; i++)
        for (const s of encoded) scureNext.base32crockford.decode(s)
      b.end()
    })
  }

  for (const [w, buffers] of workloads) {
    bench(
      `@scure/base unreleased rfc4648 base32 decode ${w} 100 times`,
      (b) => {
        const encoded = buffers.map((buf) => scureNext.base32.encode(buf))
        b.start()
        for (let i = 0; i < 100; i++)
          for (const s of encoded) scureNext.base32.decode(s)
        b.end()
      },
    )
  }
}

for (const [w, buffers] of workloads) {
  bench(`base-x z-base-32 decode ${w} 100 times`, (b) => {
    const encoded = buffers.map((buf) => zbase32.encode(buf))
    b.start()
    for (let i = 0; i < 100; i++) for (const s of encoded) zbase32.decode(s)
    b.end()
  })
}

for (const [w, buffers] of workloads) {
  bench(`Buffer.from(s, 'hex') decode ${w} 100 times`, (b) => {
    const encoded = buffers.map((buf) => buf.toString('hex'))
    b.start()
    for (let i = 0; i < 100; i++) for (const s of encoded) Buffer.from(s, 'hex')
    b.end()
  })
}
