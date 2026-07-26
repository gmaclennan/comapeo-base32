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

100 iterations over 10,000 random buffers (0–100 bytes each) on Node 24, Linux
x64. Lower is better; each figure is the median of three runs. Run with
`npm run bench`.

| Library                   | encode  | decode  |
| ------------------------- | ------- | ------- |
| **@comapeo/base32**       | 292 ms  | 822 ms  |
| z32                       | 699 ms  | 585 ms  |
| rfc4648                   | 798 ms  | 1589 ms |
| base32                    | 1122 ms | 2649 ms |
| crockford-base32          | 1914 ms | 4455 ms |
| @scure/base (crockford)   | 3723 ms | 3435 ms |
| @scure/base (rfc4648)     | 4049 ms | 3430 ms |
| base-x (z-base-32)        | 8754 ms | 9517 ms |
| `Buffer` hex (not base32) | 158 ms  | 208 ms  |

Absolute times are roughly 3× higher than on Apple Silicon; z32 remains ahead
on decode here. Re-run the benchmark on your own target before drawing
conclusions.

Short inputs are the case most worth optimising, and the one these averages
hide. Encoding a single buffer costs ~83 ns at 8 bytes and ~181 ns at 32 bytes
(12M and 5.5M ops/s respectively).

`@scure/base` is measured at the released 2.2.0. Its unreleased `main` is
substantially quicker (~2620 ms encode / ~1880 ms decode for crockford in the
same harness), so expect this gap to narrow in its next release.

## License

MIT
