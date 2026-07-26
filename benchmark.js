import bench from 'nanobench'
import { createHash } from 'node:crypto'
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

// `@scure/base-next` is unreleased upstream `main`, installed from git, so it
// ships only `index.ts`. Node can strip the types but refuses to for files
// under `node_modules`, so apply its stripper by hand — ~55 ms once at import,
// before anything is measured.
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

// Deterministic input generation: a SHA-256 hash chain over a fixed seed
// (mafintosh's `random-bytes-seed` construction, dependency-free). Every run
// measures identical inputs, with none of the statistical quirks of a
// hand-rolled PRNG.
let chainState = new TextEncoder().encode('@comapeo/base32 benchmark v1')

/** @param {number} n */
function randomBytes(n) {
  const buf = Buffer.allocUnsafe(n)
  for (let used = 0; used < n; used += 32) {
    chainState = createHash('sha256').update(chainState).digest()
    buf.set(chainState.subarray(0, n - used), used)
  }
  return buf
}

/** @param {number} count */
function makeMixedBuffers(count) {
  // Sizes in [0, 100], from two chain bytes (16-bit mod 101; bias ~0.1%).
  const sizeBytes = randomBytes(2 * count)
  return Array.from({ length: count }, (_, i) =>
    randomBytes(((sizeBytes[2 * i] << 8) | sizeBytes[2 * i + 1]) % 101),
  )
}

/**
 * Fixed 32-byte buffers (the typical "encoded ID" case) and mixed random
 * lengths of 0-100 bytes.
 *
 * @type {[string, Buffer[]][]}
 */
const workloads = [
  ['32B', Array.from({ length: 1e4 }, () => randomBytes(32))],
  ['0-100B', makeMixedBuffers(1e4)],
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
