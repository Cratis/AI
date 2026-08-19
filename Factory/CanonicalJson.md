# Factory canonical JSON version 1

Factory canonical JSON gives deterministic Factory operations one exact byte
representation for the bounded JSON value domain they share. It is the input to
canonical content hashes and explicit self-hashes; it is not a signature, an
authorization decision, or proof that a document came from a trusted authority.

The language-neutral conformance source is
[`Fixtures/Contracts/v1/canonical-json-vectors.json`](./Fixtures/Contracts/v1/canonical-json-vectors.json).
`Factory.Core` implements these rules in process for supported product paths.

## Accepted values and parsing limits

An input is exactly one JSON value encoded as UTF-8. Leading and trailing JSON
whitespace is accepted and discarded. A UTF-8 byte order mark, malformed UTF-8,
comments, trailing commas, duplicate decoded object keys, and malformed JSON are
rejected. Duplicate-key comparison is ordinal and case-sensitive after JSON
escape decoding.

The value domain contains `null`, Booleans, strings, arrays, objects, and
integers from `-9007199254740991` through `9007199254740991`, inclusive. Raw
`-0` is accepted and canonicalizes to `0`. Fractions and exponent forms are
rejected even when their mathematical value is an integer. `NaN`, positive or
negative infinity, and other non-JSON number spellings are rejected.

These inclusive limits are part of the accepted version 1 parsing contract:

| Resource | Inclusive maximum | Unit |
| --- | ---: | --- |
| Input document | 2,000,000 | UTF-8 bytes |
| Canonical output | 2,000,000 | UTF-8 bytes |
| Container nesting | 64 | object or array containers; a root container has depth 1 |
| Decoded string value | 1,000,000 | Unicode scalar values per string |
| Decoded object key | 1,000,000 | Unicode scalar values per key |
| Structural punctuation | 100,000 | `{`, `}`, `[`, `]`, `,`, and `:` tokens outside strings |
| One array | 99,999 | items |
| One object | 49,999 | members |

These parsing limits are new in the native parity slice. The temporary Python
value oracle was unbounded and accepted already-materialized Python values; the
migration adapter applies the accepted limits around parsing and labels that
boundary. The limits must not be described as historical Python behavior.

## Exact canonical bytes

Canonical output is compact UTF-8 with no insignificant whitespace. Array order
is preserved. Object keys are sorted recursively by Unicode scalar value. This
is deliberately not RFC 8785/JCS ordering, which uses UTF-16 code units; for the
discriminating pair in the golden vectors, U+E000 sorts before U+10000.

Strings preserve their Unicode scalar sequence without NFC, NFD, or other
normalization. Canonically equivalent Unicode sequences can therefore produce
different bytes and hashes. Literal and escaped spellings of the same scalar
produce the same canonical scalar. Lone surrogate escapes are rejected.
Quotation mark and reverse solidus are escaped. The short JSON escapes are used
for backspace, tab, newline, form feed, and carriage return; the remaining C0
controls use lowercase `\u00xx`. Solidus, non-ASCII scalars, DEL, C1 controls,
Unicode bidirectional controls, and U+2028/U+2029 are not unnecessarily escaped.

The canonical core accepts controls that belong to the JSON value domain. That
does not make those controls safe to display or persist as trusted prose.
Operation results and later human or machine projections must separately apply
their terminal-control, multiline, classification, and privacy contracts.
Canonical parsing failures contain only stable codes and bounded numeric
metadata; they do not reflect hostile input, parser text, source paths, or PII.

## Hash operations

A hash is lowercase `sha256:` followed by 64 lowercase hexadecimal digits.
Callers must select the operation their contract declares:

- A raw byte hash covers the exact supplied bytes without parsing or
  canonicalization.
- A whole canonical hash covers every canonical UTF-8 byte, including any
  property named `contentHash` or `requestHash`.
- An explicit `contentHash` self-hash hashes a top-level object after omitting
  only its top-level `contentHash` member.
- An explicit `requestHash` self-hash hashes a top-level object after omitting
  only its top-level `requestHash` member.

Self-hash omission is never recursive. Nested fields and the other top-level
hash field remain included. Calculation requires an object root and produces
the same result whether the selected field is present or already absent.
Verification reports typed `RootNotObject`, `Missing`, `Malformed`, `Mismatch`,
or `Verified` status. No API infers self-hash semantics merely from a property
name.

This distinction matters for artifact descriptors: a descriptor's
`contentHash` can identify the exact bytes of a separate payload. Such a field
must be whole-hashed when the descriptor contract says so; generic canonical
code must not silently treat it as the descriptor's self-hash.

Canonicalization and hashing consume bytes and values, not paths or display
projections. Source-path, operating-system path syntax, newline style around an
input, and human-versus-machine projection hints cannot affect canonical output
once the same JSON value is parsed.

Hashes establish deterministic integrity only. Server-issued identity,
signatures, current repository binding, policy, authorization, and approval are
separate trust decisions.

## Temporary differential migration boundary

The permanent `Factory.Core` specification suite reads only the language-neutral
vectors and runs only .NET. It never starts Python and is the supported
conformance gate.

`Migration/CanonicalJsonParity` is a non-packable, non-publishable maintainer
tool outside `Planner.slnx`. An explicit maintainer run starts its local Python
adapter, supplies the same exact vector bytes to the native implementation and
the existing `scripts/canonical_json.py` value oracle, and compares accepted or
rejected outcomes, canonical bytes, hashes, explicit self-hashes, verification
status, and repeat determinism. No product or supported command references the
tool or starts a Python process.

After independent native parity acceptance, delete this migration tool together
with the Python oracle, Python requirements, and duplicate Python semantic
tests. Keep the language-neutral vectors and permanent native conformance suite
as the single executable contract.
