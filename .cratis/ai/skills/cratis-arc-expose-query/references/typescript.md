# Expose a finite query before making it live

Export a `@readModel()` class and mark its **static** method `@query()`. Bind caller inputs with `argument()`, injected services with `service()` and execution options with `queryOptions()` where explicit descriptors are needed. An instance method is not a query. Use `T | undefined` for an optional argument, not an invented empty value. Keep credentials and tenant context out of the argument list.

A finite query returns a value or promise; returning `undefined` successfully gives HTTP 200 without `data`. Let store failures propagate so an unavailable database does not look like a missing row. For live results return the scoped `collection.observe()` source, not a previously loaded list. For protected data use the typed read-model pipeline with the model and `subjectFor` configured, not raw Mongo documents. Intercept the exact top-level runtime model; a nested plain object is not automatically intercepted.

| Stage | Diagnostic boundary |
| --- | --- |
| Authenticate, select tenant, read GET arguments or QUERY body | Distinguish a challenge, missing tenant and malformed input. |
| Declared authorization, binding, request and global authorization | Deny before exposing validation or caller-specific data. |
| Ordinary filters and validation | Field findings are not a failed store lookup. |
| Perform, render and intercept | Render the provider source before transforming delivered rows; preserve totals and exact model identity. |

For Chronicle, an append acknowledges persistence, not projection catch-up. Use `ChronicleReadConsistency.Immediate` only for a passive model-bound projection; an active projection cannot be converted to an immediate read by setting the option.

For a structured request send HTTP `QUERY` with a JSON object such as `{"arguments":{"id":"task-1"}}`; paging options travel alongside `arguments`, not inside it. Raw watcher `fullDocument` data for protected fields may still be ciphertext. Re-read through the released read model; do not forward raw changes to a client.
