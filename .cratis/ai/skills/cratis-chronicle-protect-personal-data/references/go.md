# Declare Go field policies and the subject

Use the `chronicle:"pii"` struct tag for a personal field, and a separate opaque `chronicle:"subject"` field or explicit `eventsequences.WithSubject(...)` at append. Preserve the subject metadata when passing the stored model document to `store.ReadModels().Release(ctx, model.Identifier(), document)`. Check its error before using the returned data. Separately test `store.Compliance().DeleteEncryptionKeyFor(ctx, subject)` with a disposable subject. Do not substitute the view key when it identifies a different person.
