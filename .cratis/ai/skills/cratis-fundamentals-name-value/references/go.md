# Define a Go concept at its boundary

For a string value use an application-owned defined type and expose its primitive to the concept contract:

```go
type AuthorName string

func (name AuthorName) ConceptValue() string { return string(name) }
```

A UUID-backed identity also needs the codecs used by the chosen transport and store. Forward text and JSON handling to the underlying UUID and propagate decode errors rather than returning a zero identity. Test a round-trip of the real payload plus an invalid UUID; satisfying `concepts.Concept[T]` alone is not a codec test.
