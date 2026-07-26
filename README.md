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
result may be a view onto a shared `ArrayBuffer` that this library uses as an
allocation pool (this sidesteps a malloc per call that would otherwise
dominate decode time). The bytes of the view are yours; its `.buffer` is not:
it may have a non-zero `byteOffset`, contain other decode results, and stay
allocated while any result in it is referenced. If you need a result backed
by its own `ArrayBuffer` — say, to transfer it to a worker — copy it with
`.slice()`.

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

Two workloads of 10,000 buffers each, 100 iterations per measurement, on
Node 24, Linux x64: fixed 32-byte buffers (the typical "encoded ID" case) and
mixed random lengths of 0–100 bytes. Buffers come from a seeded SHA-256 hash
chain (via Web Crypto), so every run measures identical, well-distributed
inputs. Lower is better; each figure is the median of three runs. Run with
`npm run bench`.

| Library                            | encode 32B | encode 0–100B | decode 32B | decode 0–100B |
| ---------------------------------- | ---------- | ------------- | ---------- | ------------- |
| **@comapeo/base32**                | 184 ms     | 295 ms        | 205 ms     | 284 ms        |
| z32                                | 496 ms     | 693 ms        | 410 ms     | 502 ms        |
| rfc4648                            | 553 ms     | 785 ms        | 1268 ms    | 1873 ms       |
| base32                             | 795 ms     | 1147 ms       | 1585 ms    | 2668 ms       |
| crockford-base32                   | 1258 ms    | 1856 ms       | 2839 ms    | 4341 ms       |
| @scure/base unreleased (crockford) | 1073 ms    | 2589 ms       | 665 ms     | 1854 ms       |
| @scure/base unreleased (rfc4648)   | 1150 ms    | 2603 ms       | 627 ms     | 1800 ms       |
| @scure/base 2.2.0 (crockford)      | 2504 ms    | 3593 ms       | 2360 ms    | 3566 ms       |
| @scure/base 2.2.0 (rfc4648)        | 2695 ms    | 3961 ms       | 2350 ms    | 3693 ms       |
| base-x (z-base-32)                 | 3150 ms    | 9512 ms       | 3394 ms    | 10003 ms      |
| `Buffer` hex (not base32)          | 85 ms      | 138 ms        | 171 ms     | 193 ms        |

Absolute times are roughly 3× higher than on Apple Silicon. Re-run the
benchmark on your own target before drawing conclusions.

Short inputs are the case most worth optimising, and the one these averages
hide. Encoding a single buffer costs ~83 ns at 8 bytes and ~181 ns at 32 bytes
(12M and 5.5M ops/s respectively); decoding costs ~76 ns and ~157 ns at the
same sizes (13M and 6.4M ops/s).

The "unreleased" rows are upstream `@scure/base` `main` (commit `3b06771`),
which carries a large unmerged speed-up. It is installed from git under the
alias `@scure/base-next`, so it arrives as TypeScript with no build step, and
the benchmark strips its types at load. That needs a Node with type stripping
(22.18+ or 24+); on anything older those four cases are skipped and the rest
still run. Stripping costs ~55 ms once at import and does not affect the
measurements, which start after every module has loaded.

## License

MIT
