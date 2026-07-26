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

`decode` returns a `Uint8Array`. In Node, outputs larger than 64 bytes are
allocated from the `Buffer` pool (so they are `Buffer` instances, a
`Uint8Array` subclass, sharing a pooled `ArrayBuffer`) — this sidesteps a
malloc per call that would otherwise dominate decode time.

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

100 iterations over 10,000 random buffers (0–100 bytes each) on Node 24, Linux
x64. Lower is better; each figure is the median of three runs. Run with
`npm run bench`.

| Library                            | encode  | decode  |
| ---------------------------------- | ------- | ------- |
| **@comapeo/base32**                | 265 ms  | 301 ms  |
| z32                                | 615 ms  | 458 ms  |
| rfc4648                            | 779 ms  | 1624 ms |
| base32                             | 1117 ms | 2226 ms |
| crockford-base32                   | 1818 ms | 3803 ms |
| @scure/base unreleased (crockford) | 3202 ms | 1875 ms |
| @scure/base unreleased (rfc4648)   | 3323 ms | 2215 ms |
| @scure/base 2.2.0 (crockford)      | 3308 ms | 3362 ms |
| @scure/base 2.2.0 (rfc4648)        | 3474 ms | 3404 ms |
| base-x (z-base-32)                 | 8786 ms | 8947 ms |
| `Buffer` hex (not base32)          | 162 ms  | 199 ms  |

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
