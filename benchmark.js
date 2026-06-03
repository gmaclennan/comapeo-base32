import bench from 'nanobench'
import { randomBytes } from 'node:crypto'
import * as base32 from './index.js'
import { CrockfordBase32 } from 'crockford-base32'
import * as z32 from 'z32'
import legacyBase32 from 'base32'
import { base32 as rfc4648 } from 'rfc4648'
import baseX from 'base-x'

const zbase32 = baseX('ybndrfg8ejkmcpqxot1uwisza345h769')

const buffers = Array(1e4)
  .fill(null)
  .map(() => randomBytes(Math.round(Math.random() * 100)))

bench('@comapeo/base32 encode 100 times', (b) => {
  b.start()
  for (let i = 0; i < 100; i++) for (const buf of buffers) base32.encode(buf)
  b.end()
})

bench('crockford-base32 encode 100 times', (b) => {
  b.start()
  for (let i = 0; i < 100; i++)
    for (const buf of buffers) CrockfordBase32.encode(buf)
  b.end()
})

bench('z32 encode 100 times', (b) => {
  b.start()
  for (let i = 0; i < 100; i++) for (const buf of buffers) z32.encode(buf)
  b.end()
})

bench('base32 encode 100 times', (b) => {
  b.start()
  for (let i = 0; i < 100; i++)
    for (const buf of buffers) legacyBase32.encode(buf)
  b.end()
})

bench('rfc4648 base32 encode 100 times', (b) => {
  b.start()
  for (let i = 0; i < 100; i++)
    for (const buf of buffers) rfc4648.stringify(buf)
  b.end()
})

bench('base-x z-base-32 encode 100 times', (b) => {
  b.start()
  for (let i = 0; i < 100; i++) for (const buf of buffers) zbase32.encode(buf)
  b.end()
})

bench("buf.toString('hex') encode 100 times", (b) => {
  b.start()
  for (let i = 0; i < 100; i++) for (const buf of buffers) buf.toString('hex')
  b.end()
})

bench('@comapeo/base32 decode 100 times', (b) => {
  const encoded = buffers.map((buf) => base32.encode(buf))
  b.start()
  for (let i = 0; i < 100; i++) for (const s of encoded) base32.decode(s)
  b.end()
})

bench('crockford-base32 decode 100 times', (b) => {
  const encoded = buffers.map((buf) => CrockfordBase32.encode(buf))
  b.start()
  for (let i = 0; i < 100; i++)
    for (const s of encoded) CrockfordBase32.decode(s)
  b.end()
})

bench('z32 decode 100 times', (b) => {
  const encoded = buffers.map((buf) => z32.encode(buf))
  b.start()
  for (let i = 0; i < 100; i++) for (const s of encoded) z32.decode(s)
  b.end()
})

bench('base32 decode 100 times', (b) => {
  const encoded = buffers.map((buf) => legacyBase32.encode(buf))
  b.start()
  for (let i = 0; i < 100; i++) for (const s of encoded) legacyBase32.decode(s)
  b.end()
})

bench('rfc4648 base32 decode 100 times', (b) => {
  const encoded = buffers.map((buf) => rfc4648.stringify(buf))
  b.start()
  for (let i = 0; i < 100; i++)
    for (const s of encoded) rfc4648.parse(s, { out: Buffer.allocUnsafe })
  b.end()
})

bench('base-x z-base-32 decode 100 times', (b) => {
  const encoded = buffers.map((buf) => zbase32.encode(buf))
  b.start()
  for (let i = 0; i < 100; i++) for (const s of encoded) zbase32.decode(s)
  b.end()
})

bench("Buffer.from(s, 'hex') decode 100 times", (b) => {
  const encoded = buffers.map((buf) => buf.toString('hex'))
  b.start()
  for (let i = 0; i < 100; i++) for (const s of encoded) Buffer.from(s, 'hex')
  b.end()
})
