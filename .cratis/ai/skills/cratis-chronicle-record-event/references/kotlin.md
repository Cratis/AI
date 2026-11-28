# Append from a Kotlin coroutine

Declare `@EventType(id = "author-registered") data class AuthorRegistered(val name: String)` and include it in registration. In the scoped store use `val result = store.eventLog.append(authorId, AuthorRegistered(name))`. Inspect `result.isSuccess` before publishing success to the caller. The source ID passed to append, not a similarly named payload field, selects the history.

Without an explicit event ID the class simple name is used. Two packages can have the same simple name. Preserve the deployed ID when moving the class. A failed append can report constraint or concurrency violations: inspect which rule refused before deciding whether to reevaluate.
