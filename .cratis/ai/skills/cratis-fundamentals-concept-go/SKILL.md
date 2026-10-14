---
name: cratis-fundamentals-concept-go
description: Define named Go domain values with Fundamentals.Go concepts, explicit UUID text and JSON codecs, and scalar recognition. Use when an identity or scalar must not be interchangeable with its primitive. Do not use for C# ConceptAs types, event migration or dependency-injection setup.
license: MIT
compatibility: Go 1.26 or later.
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Typed domain values in Go

> **Experimental v0:** minor releases may break APIs; pin the module version you test against.
> Companion guidance: Chronicle.Go and Arc.Go.

Use a defined type for each domain value, not a type alias that remains
interchangeable with every UUID/string. Plain constructors are enough; adopting
concepts does not require a dependency-injection container.

## Verified product sources

| Product | Source checked |
| --- | --- |
| Fundamentals.Go (`github.com/cratis/fundamentals.go`) | `concepts/concept.go`, `concepts/uuid.go`, `concepts/uuid_dotnet.go`, `concepts/underlying.go`, `concepts/check_json.go`, `documentation_examples_test.go` |

[Source](https://github.com/Cratis/Fundamentals.Go)
is authoritative, not an older installation pin on a getting-started page.
The root module is standard-library-only and requires Go 1.26.

## Define and encode an identity

Install `github.com/cratis/fundamentals.go` at your chosen release into a consumer module.
This complete package defines an author identity and its codecs:

```go
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

package domain

import "github.com/cratis/fundamentals.go/concepts"

// AuthorID identifies an author in the domain.
type AuthorID concepts.UUID

var _ concepts.Concept[concepts.UUID] = AuthorID{}

// ConceptValue exposes the declared scalar representation.
func (id AuthorID) ConceptValue() concepts.UUID { return concepts.UUID(id) }

// MarshalText encodes canonical dashed UUID text.
func (id AuthorID) MarshalText() ([]byte, error) {
	return concepts.UUID(id).MarshalText()
}

// MarshalJSON encodes a UUID string, not a byte array.
func (id AuthorID) MarshalJSON() ([]byte, error) {
	return concepts.UUID(id).MarshalJSON()
}

// UnmarshalText decodes UUID text without changing id on failure.
func (id *AuthorID) UnmarshalText(data []byte) error {
	return (*concepts.UUID)(id).UnmarshalText(data)
}

// UnmarshalJSON decodes a UUID string without changing id on failure.
func (id *AuthorID) UnmarshalJSON(data []byte) error {
	return (*concepts.UUID)(id).UnmarshalJSON(data)
}

// ParseAuthorID reads an identity in dashed UUID notation.
func ParseAuthorID(text string) (AuthorID, error) {
	id, err := concepts.ParseUUID(text)
	return AuthorID(id), err
}
```

Defined types do **not** inherit methods. Without these forwarding codecs, a
UUID-derived value can serialize as an array. Value encoding receivers also work
for unaddressable map entries; decoding needs a pointer receiver. Test text,
JSON, map-key and invalid-input round trips, not just the marker assertion.

`ParseUUID` accepts dashed 8-4-4-4-12 notation, including uppercase hex, and emits
lowercase dashed text. UUID bytes are RFC/network order, not .NET
`Guid.ToByteArray` order. Zero is `Guid.Empty`; UUID JSON decoding rejects `null`.
Use an explicit nullable representation when absence is part of the contract.
`NewUUID` returns a cryptographically random v4 UUID **and an error**.

## Recognition is not business validation

`Concept[T]` declares `ConceptValue() T`. A recognized declaration also needs
value text/JSON encoders and pointer decoders representing that scalar. Supported
representations are the built-in string/bool/numeric types and Fundamentals'
`UUID`, `DateOnly`, `TimeOnly`, `TimeSpan`; arbitrary defined replacements are not
accepted as scalar representations.

`Underlying` checks declaration metadata without running application code.
`CheckJSON` checks encoded scalar shape, not business invariants or equality to
`ConceptValue`. Put domain rules in your constructor/validation boundary and test
them; do not assume implementing a marker validates input everywhere.

`ParseDotNetGUID` is an opt-in compatibility parser for broader .NET forms. It
does not change `ParseUUID` or text/JSON/SQL codecs. Limit untrusted input and use
it only when importing that compatibility contract, not for canonical admission.

## Verify

- Compile and round-trip the named value against the pinned module without local replacements.
- Verify canonical wire bytes, zero/null policy and failure-atomic decoders.
- Check domain invariants separately from scalar recognition.
- Chronicle.Go and Arc.Go each declare the Fundamentals.Go they require; this standalone example is not a demand to upgrade their dependencies.
