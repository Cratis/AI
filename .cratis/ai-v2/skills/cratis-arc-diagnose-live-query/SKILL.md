---
name: cratis-arc-diagnose-live-query
description: Finds where a live query stops updating. Use when the author list connects but does not change after registration. Not for implementing the query (use cratis-arc-expose-query).
compatibility: Requires curl and Node.js for the stream check, and a running Library host.
---

# Find the missing author update

Trace one [RegisterAuthor](../cratis-arc-declare-command/SKILL.md) on one existing [AllAuthors](../cratis-arc-expose-query/SKILL.md) subscription. Use the same authenticated caller, tenant and database throughout.

1. From the skill directory, open the direct query at the host's listening address, with the same credentials used for the query in the browser. The example assumes HTTPS port 5001, prefix `/api`, one namespace segment skipped and authentication already configured for curl. Substitute the running host's origin if different:

   ```sh
   curl -sN --max-time 60 -H 'Accept: text/event-stream' https://localhost:5001/api/authors/all-authors | node scripts/check-frames.mjs
   ```

2. The script counts ready frames, not their contents. Wait for `Ready result 1`. In another session register Aster once. Look up the supplied `AuthorId` in the Mongo database used by this tenant. If the document is missing, investigate the [projection](../cratis-chronicle-project-view/SKILL.md) before debugging delivery.
3. If the document exists but no `Ready result 2` arrives, check that Mongo supports change streams (replica set or sharded cluster) and that `Authors/Author.cs` returns `collection.Observe()`, not a materialized list.
4. If curl gets the update, inspect the browser's network connection to `/.cratis/queries/ws` or `/.cratis/queries/sse`. For WebSockets, enable `app.UseWebSockets()` before `app.UseCratis()` in `Program.cs`. Check for the same ID in the delivered data before changing the React component.

## Avoid

- Do not use `waitForFirstResult=true` for this probe; it stops after the first result.
- Do not use `/.cratis/queries/health` to check that the author document exists; it describes connections.
- Do not require a delta on the first result. It is a snapshot; later delta deliveries need a stable `Id`.
- Do not reconnect between registration and inspection; a new subscription starts with a fresh snapshot.

## Related skills

- [Connect the Mongo reader](../cratis-arc-connect-storage/SKILL.md)
- [Expose the observable query](../cratis-arc-expose-query/SKILL.md)
