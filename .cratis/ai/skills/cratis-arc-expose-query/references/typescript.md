# Expose a finite query before making it live

Export a `@readModel()` class and mark its **static** method `@query()`. Bind caller inputs with `argument()`, injected services with `service()` and execution options with `queryOptions()` where explicit descriptors are needed. An instance method is not a query. Use `T | undefined` for an optional argument, not an invented empty value. Keep credentials and tenant context out of the argument list.

A finite query returns a value or promise; returning `undefined` successfully gives HTTP 200 without `data`. Let store failures propagate so an unavailable database does not look like a missing row. For live results return the scoped `collection.observe()` source, not a previously loaded list. For protected Mongo reads, follow the release boundary below.

| Stage | Diagnostic boundary |
| --- | --- |
| Authenticate, select tenant, read GET arguments or QUERY body | Distinguish a challenge, missing tenant and malformed input. |
| Declared authorization, binding, request and global authorization | Deny before exposing validation or caller-specific data. |
| Ordinary filters and validation | Field findings are not a failed store lookup. |
| Perform, render and intercept | Render the provider source before transforming delivered rows; preserve totals and exact model identity. |

## Extend the pipeline at the right stage

- **Authorize before execution.** Declare `@authorizationQueryFilter()` with `onPerform(context)` returning `unauthorizedQueryResult(context)` on denial. Register with `builder.add()` or `addAuthorizationQueryFilter(token)`. It runs before validators and performers are constructed; rendering and interception are too late for authorization.
- **Render a provider-owned source.** Implement `QueryRenderer` with `canRender(value)` and `render(value, context, options)`. Register `@queryRenderer()` via `builder.add()` or discovery, or use a scoped token with `addQueryRenderer(token)` (`queryRenderers` on `ArcServer`). The first accepting renderer in registration order owns sorting and paging. Return `queryPage(items, totalItems, sorting)` with the total over the authorized result set, not a count of the intercepted slice.
- **Shape delivered rows.** Implement `ReadModelInterceptor` with `model = X` and `intercept(row)` returning a replacement without mutating the original. Register `@readModelInterceptor()` the same way, or use a scoped token with `addReadModelInterceptor(token)` (`readModelInterceptors` on `ArcServer`). Interceptors run in registration order after rendering and match the exact runtime class of a top-level result or page/array item, not nested instances.

Admission filters and validation run once per subscription; rendering and interception run for the snapshot and every emission. Test shaping on a second emission separately from the emission guard that terminates access after revocation.

Spec a query that returns a shared model instance: assert the transformed value reaches the consumer and the original still has its initial values. If two renderers accept the source, assert only the first renderer's result is served.

For Chronicle, an append acknowledges persistence, not projection catch-up. Use `ChronicleReadConsistency.Immediate` only for a passive model-bound projection; an active projection cannot be converted to an immediate read by setting the option.

For a structured request send HTTP `QUERY` with a JSON object such as `{"arguments":{"id":"task-1"}}`; paging options travel alongside `arguments`, not inside it.

## Choose a safe protected Mongo result

Use typed `MongoReadModels` with the `readModel` registered with `withChronicle`. Use the stored `__subject` or a string or finite numeric `_id` by default; set `subjectFor` if neither supplies the correct subject. An explicit subject must agree with any stored subject. Typed reads reject MongoDB `projection` options: return the complete document. Return it directly, in an array, or in `queryPage`; another wrapper (including `MongoReadModels.page()`'s `MongoPage`) fails release. Do not copy or map it before the release step.

Release fails closed on a subject or tenant mismatch, undeclared fields, missing schema, or non-JSON driver values in model fields such as `ObjectId`, `Binary` or `Decimal128`. A nonempty `__subjects` (per-property subjects) cannot be released this way; read the model through `ChronicleReadModels`. Untyped `MongoReadModels` and `MongoDBWatcher.changes()` expose values as stored, including ciphertext: never forward those documents to a client. Re-read through the released model. Release is not authorization; filter by the verified caller separately.
