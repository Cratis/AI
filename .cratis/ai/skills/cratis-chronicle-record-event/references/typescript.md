# Append a registered Node event

For an author registration, use `@eventType("author-registered")` on the event class and `@field(String)` on its name field. Load it during artifact discovery. Send `const result = await store.eventLog.append(authorId, new AuthorRegistered(name));` using the stable author ID. Check `result.isSuccess`; do not interpret a fulfilled promise as acceptance. Preserve the refusal details without logging the event body.

The implicit ID comes from `constructor.name`; minification and class renames can change it. Keep an explicit ID across builds. Do not mix conflicting concurrency scopes in one unit; surface the conflict rather than silently replacing one participant’s guard.
