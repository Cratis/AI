# Name a Go scalar at its boundary

For a string identity, default to a defined type (not an alias). It stays distinct in Go and remains a string in JSON:

```go
type BookID string
```

Keep `BookID` on the command. When passing it to Chronicle's `EventForSource`, convert it explicitly with `chronicle.EventSourceID(c.BookID)` as in `cratis-arc-declare-command` (in `cratis/arc/go`).

Use the `cratis-fundamentals-concept-go` skill (installed by the `cratis/fundamentals/go` profile) when you need SDK concept recognition, for example for a UUID-backed identity. Do not add `ConceptValue` by itself: Arc rejects a concept declaration without the required text and JSON codecs when building the command pipeline.
