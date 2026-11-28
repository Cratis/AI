# Append through the Java facade

Declare a Java record `@EventType(id = "author-registered") public record AuthorRegistered(String name) {}` in its own file and register it. On the blocking store, `var result = store.getEventLog().append(authorId, new AuthorRegistered(name));`. Inspect the outcome before using `result.getSequenceNumberValue()` as a position. Do not call suspend APIs or invent a position when transport fails.
