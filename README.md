# @comapeo/base32

A fast, dependency-free encoder/decoder for Douglas Crockford's
[Base 32](https://www.crockford.com/base32.html). It operates on `Uint8Array`s,
so it runs in the browser, Deno, and Node.

## Install

```bash
npm install @comapeo/base32
```

## Usage

```js
import { encode, decode, verify } from '@comapeo/base32'

encode(new Uint8Array([0x74, 0x74])) // 'EHT0'
encode('some string') // 'EDQPTS90EDT74TBECW'  (UTF-8 strings are accepted)

decode('EHT0') // Uint8Array [0x74, 0x74]

// Decoding is forgiving, per the Crockford spec:
decode('edqpts-90edt7-4tbecw') // hyphens ignored, case ignored
decode('IPLOE') // I/L -> 1, O -> 0
```

`decode` always returns a `Uint8Array`, but — like Node's `Buffer` APIs — the
result may be a view onto a shared `ArrayBuffer` used as an allocation pool.
The bytes of the view are yours; its `.buffer` is not: it may have a non-zero
`byteOffset`, contain other decode results, and stay allocated while any
result in it is referenced. To get a result backed by its own `ArrayBuffer` —
say, to transfer it to a worker — copy it with `.slice()`.

### Checksums

Crockford's optional [check symbol](https://www.crockford.com/base32.html) is a
single trailing character — the input value mod 37 — used to catch transcription
errors. Opt in with `{ checksum: true }`:

```js
encode(new Uint8Array([0xff]), { checksum: true }) // 'ZW~'
decode('ZW~', { checksum: true }) // Uint8Array [0xff]
```

When validation fails, `decode` throws one of two typed errors:

```js
import {
  decode,
  InvalidChecksumCharacterError, // trailing symbol is not a valid check char
  InvalidChecksumError, // valid char, but it does not match the data
} from '@comapeo/base32'
```

For a true/false check that never throws, use `verify`:

```js
verify('ZW~') // true
verify('ZW0') // false (mismatched checksum)
verify('ZW!') // false (invalid check character)
```

## Scope

This library implements the default Crockford bit-stream interpretation (the
same one as RFC 4648), plus check symbols.

## Benchmarks

Benchmarks run with [Vitest bench](https://vitest.dev/guide/features#benchmarking)
in Node (`npm run bench`) and in real browsers via Playwright
(`npm run bench:browser`). Two workloads of 10,000 buffers: fixed 32-byte
buffers (the typical "encoded ID" case) and mixed random lengths of 0–100
bytes, generated from a seeded SHA-256 hash chain so every run measures
identical, well-distributed inputs. Each figure is the mean time for one pass
over a workload (lower is better), measured on Node 24 / Chromium 141, Linux
x64.

**Node:**

| Library                       | encode 32B | encode 0–100B | decode 32B | decode 0–100B |
| ----------------------------- | ---------- | ------------- | ---------- | ------------- |
| **@comapeo/base32**           | 2.1 ms     | 2.9 ms        | 2.7 ms     | 3.6 ms        |
| z32                           | 6.9 ms     | 9.1 ms        | 6.2 ms     | 8.0 ms        |
| rfc4648                       | 7.9 ms     | 9.2 ms        | 9.5 ms     | 14.4 ms       |
| base32                        | 9.6 ms     | 12.1 ms       | 18.3 ms    | 25.1 ms       |
| crockford-base32              | 15.6 ms    | 20.5 ms       | 29.2 ms    | 43.6 ms       |
| @scure/base 2.2.0 (crockford) | 28.3 ms    | 42.2 ms       | 25.1 ms    | 36.2 ms       |
| @scure/base 2.2.0 (rfc4648)   | 29.6 ms    | 44.1 ms       | 21.6 ms    | 34.9 ms       |
| base-x (z-base-32)            | 31.0 ms    | 98.9 ms       | 34.6 ms    | 107.8 ms      |
| `Buffer` hex (not base32)     | 1.2 ms     | 1.7 ms        | 1.6 ms     | 2.1 ms        |

**Chromium** (libraries that require Node's `Buffer` — crockford-base32,
base32, and `Buffer` hex — only run in Node):

| Library                       | encode 32B | encode 0–100B | decode 32B | decode 0–100B |
| ----------------------------- | ---------- | ------------- | ---------- | ------------- |
| **@comapeo/base32**           | 1.7 ms     | 2.8 ms        | 2.4 ms     | 3.6 ms        |
| z32                           | 5.3 ms     | 6.8 ms        | 7.9 ms     | 10.6 ms       |
| rfc4648                       | 5.9 ms     | 7.3 ms        | 10.9 ms    | 19.0 ms       |
| @scure/base 2.2.0 (crockford) | 25.9 ms    | 42.3 ms       | 19.9 ms    | 34.1 ms       |
| @scure/base 2.2.0 (rfc4648)   | 28.2 ms    | 44.5 ms       | 22.6 ms    | 36.1 ms       |
| base-x (z-base-32)            | 38.2 ms    | 106.0 ms      | 38.7 ms    | 118.9 ms      |

Absolute times are roughly 3× higher than on Apple Silicon; re-run on your
own target.

Short inputs are the case most worth optimising, and the one these averages
hide. Encoding a single buffer costs ~83 ns at 8 bytes and ~181 ns at 32 bytes
(12M and 5.5M ops/s respectively); decoding costs ~76 ns and ~157 ns at the
same sizes (13M and 6.4M ops/s).

## License

MIT
