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

`decode` returns a `Uint8Array`.

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

100 iterations over 10,000 random buffers (0–100 bytes each) on Node 22, Linux
x64. Lower is better; each figure is the median of three runs. Run with
`npm run bench`.

| Library                   | encode  | decode  |
| ------------------------- | ------- | ------- |
| z32                       | 769 ms  | 624 ms  |
| rfc4648                   | 806 ms  | 1862 ms |
| **@comapeo/base32**       | 1000 ms | 839 ms  |
| base32                    | 1153 ms | 2552 ms |
| crockford-base32          | 2000 ms | 4715 ms |
| @scure/base (crockford)   | 3744 ms | 3421 ms |
| @scure/base (rfc4648)     | 3878 ms | 3116 ms |
| base-x (z-base-32)        | 8753 ms | 9784 ms |
| `Buffer` hex (not base32) | 146 ms  | 276 ms  |

These numbers replace an earlier set measured on Node 24 / Apple Silicon, where
absolute times were roughly 3× lower and `@comapeo/base32` led on both encode
and decode. Relative standings shift with runtime and hardware — re-run the
benchmark on your own target before drawing conclusions.

`@scure/base` is measured at the released 2.2.0. Its unreleased `main` is
substantially quicker (~2170 ms encode / ~1710 ms decode for crockford in the
same harness), so expect this gap to narrow in its next release.

## License

MIT
