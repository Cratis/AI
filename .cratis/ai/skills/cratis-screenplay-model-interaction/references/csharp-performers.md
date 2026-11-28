# Realize a query performer in C#

Use a declarative query when it can express the read. For a supported Stage C# performer, attach an inline method body or use `file` for the same body. The compiler binds the query's shape but the reference engine does not execute the body; prove it in the rendered target.

For a snapshot, `readModels` supplies only the declared read model collection. Return the declared model (null only for an optional single result) or `IEnumerable<T>` for a collection. Caller arguments are available by camelCase name and on `context.Arguments` as PascalCase properties. `context` also supplies `Tenant`, `Identity` and `ReceivedAt`; this is query context, not event or command causation. A performer argument cannot source its value from `$context`.

````play
query OpenTalks => Talk[]
  filter track String
  performer
    ```csharp
    return readModels.Where(talk => talk.Track == track);
    ```
````

For `=> observable Talk[]`, `readModels` is a `LiveReadModels<Talk>` and the body returns `IObservable<IEnumerable<Talk>>`. The source starts with the current collection; each emission from the body is the complete query result, not a delta. The target captures context and arguments once per client subscription and disposes on unsubscribe, disconnect or shutdown. `OnError` and `OnCompleted` end the subscription without resubscribing. A live single or optional read has no live performer contract.

Stage's snapshot contract is context/result `1/1`; a live collection requires `1/2` and a declared read model that its projection or reducer can supply. A verified C# body renders as a compile-checked helper. A non-C# body can refuse the plan (`STAGE-IMPL-LANGUAGE`). Treat a missing, changed, hash-invalid or non-compiling attachment or a live contract the target cannot observe or admit as undelivered, even when the renderer produces a compilable gap stub. Repair the attachment or report the gap; don't hand-write a replacement for an admitted performer.
