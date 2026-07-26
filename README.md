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
mixed random lengths of 0–100 bytes. Buffers come from a seeded PRNG, so every
run measures identical inputs. Lower is better; each figure is the median of
three runs. Run with `npm run bench`.

| Library                            | encode 32B | encode 0–100B | decode 32B | decode 0–100B |
| ---------------------------------- | ---------- | ------------- | ---------- | ------------- |
| **@comapeo/base32**                | 163 ms     | 246 ms        | 189 ms     | 265 ms        |
| z32                                | 433 ms     | 612 ms        | 294 ms     | 392 ms        |
| rfc4648                            | 512 ms     | 721 ms        | 969 ms     | 1513 ms       |
| base32                             | 739 ms     | 1090 ms       | 1338 ms    | 2191 ms       |
| crockford-base32                   | 1199 ms    | 1781 ms       | 2419 ms    | 3676 ms       |
| @scure/base unreleased (crockford) | 1245 ms    | 3014 ms       | 518 ms     | 1943 ms       |
| @scure/base unreleased (rfc4648)   | 1322 ms    | 3030 ms       | 481 ms     | 1800 ms       |
| @scure/base 2.2.0 (crockford)      | 2166 ms    | 3194 ms       | 2045 ms    | 2992 ms       |
| @scure/base 2.2.0 (rfc4648)        | 2370 ms    | 3496 ms       | 2003 ms    | 3177 ms       |
| base-x (z-base-32)                 | 2872 ms    | 8136 ms       | 3111 ms    | 8868 ms       |
| `Buffer` hex (not base32)          | 78 ms      | 137 ms        | 159 ms     | 154 ms        |

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
