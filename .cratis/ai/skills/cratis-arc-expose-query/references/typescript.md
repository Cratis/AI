# Expose a finite query before making it live

Export a `@readModel()` class and mark its **static** method `@query()`. Bind caller inputs with `argument()`, injected services with `service()` and execution options with `queryOptions()` where explicit descriptors are needed. An instance method is not a query. Use `T | undefined` for an optional argument, not an invented empty value. Keep credentials and tenant context out of the argument list.

A finite query returns a value or promise; returning `undefined` successfully gives HTTP 200 without `data`. Let store failures propagate so an unavailable database does not look like a missing row. For live results return the scoped `collection.observe()` source, not a previously loaded list. For protected data use the typed read-model pipeline with the model and `subjectFor` configured, not raw Mongo documents.

| Stage | Diagnostic boundary |
| --- | --- |
| Authenticate, select tenant, read GET arguments or QUERY body | Distinguish a challenge, missing tenant and malformed input. |
| Declared authorization, binding, request and global authorization | Deny before exposing validation or caller-specific data. |
| Ordinary filters and validation | Field findings are not a failed store lookup. |
| Perform, render and intercept | Render the provider source before transforming delivered rows; preserve totals and exact model identity. |

## Extend the pipeline at the right stage

- Declare an `@authorizationQueryFilter()` with `onPerform(context)` returning `unauthorizedQueryResult(context)` on denial. Register with `builder.add` or `addAuthorizationQueryFilter`. It runs before validators and performers are constructed. Result transformation or interception is too late for authorization.
- For a provider-owned source, use `@queryRenderer()` with `canRender(value)` and `render(value, context, options)` and register via `addQueryRenderer`. The first accepting renderer owns sorting and paging. Return `queryPage(items, totalItems, sorting)` with the provider's authoritative total over the authorized result set, not a count of the intercepted slice.
- Use `@readModelInterceptor()` with `model = X` and an `intercept` that returns a copy; register via `addReadModelInterceptor`. It matches the exact runtime class for a top-level result or page/array item, not nested instances.

Admission filters and validation run once per subscription; the result stages and interceptors run for every emission. Test shaping on a second emission separately from the emission guard that terminates access after revocation.

For Chronicle, an append acknowledges persistence, not projection catch-up. Use `ChronicleReadConsistency.Immediate` only for a passive model-bound projection; an active projection cannot be converted to an immediate read by setting the option.

For a structured request send HTTP `QUERY` with a JSON object such as `{"arguments":{"id":"task-1"}}`; paging options travel alongside `arguments`, not inside it. Raw watcher `fullDocument` data for protected fields may still be ciphertext. Re-read through the released read model; do not forward raw changes to a client.
