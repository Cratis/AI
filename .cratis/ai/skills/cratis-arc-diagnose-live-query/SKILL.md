---
name: cratis-arc-diagnose-live-query
description: Use when the stored row is confirmed correct but the open view does not receive the live query update. Not for a stale screen with an unknown failing boundary (use cratis-platform-diagnose-slice).
compatibility: Requires curl, Node.js and a running Library host.
---

# Find the missing author update

Trace one [RegisterAuthor](../cratis-arc-declare-command/SKILL.md) on one existing [AllAuthors](../cratis-arc-expose-query/SKILL.md) subscription. Use the same authenticated caller, tenant and database throughout. To check current contents only, GET the same URL with `?waitForFirstResult=true` and no SSE header. A successful one-result GET does not prove that a sustained subscription delivers later writes.

1. From the skill directory, open the direct query at the host's listening address, with the same credentials used for the query in the browser. The example assumes HTTPS port 5001, prefix `/api`, one namespace segment skipped and authentication already configured for curl. Substitute the running host's origin if different:

   ```sh
   curl -sN --max-time 60 -H 'Accept: text/event-stream' https://localhost:5001/api/features/authors/listing/all-authors | tee capture.sse
   ```

2. Wait for the first ready, successful `data:` result. In another terminal, register Aster once using the same curl credentials and tenant. Keep the printed ID:

   ```sh
   id=$(node -p "require('node:crypto').randomUUID()")
   printf 'Author ID: %s\n' "$id"
   curl -sS -X POST https://localhost:5001/api/features/authors/registration \
     -H 'Content-Type: application/json' \
     -d "{\"id\":\"$id\",\"name\":\"Aster\"}"
   ```

   Require `"isSuccess": true` in the response before looking for a query update. The route assumes `IncludeCommandNameInRoute: false` as in [Generate proxies](../cratis-arc-generate-proxies/SKILL.md).

   With the [Mongo settings](../cratis-arc-connect-storage/SKILL.md) from the Library example, the default tenant uses `library` and the camel-case pluralized `Author` collection is `authors`. Run `mongosh 'mongodb://localhost:27017/library' --quiet --eval 'db.authors.find({name:"Aster"}, {_id:1,name:1}).toArray()'` and compare the returned `_id` with the command ID. For a named tenant using Arc's default database resolver, substitute `library+<tenantId>` in the database path. If the matching document is missing, check the [projection](../cratis-chronicle-project-view/SKILL.md) before debugging delivery.
3. In the same stream, match the printed ID in a later successful result. `node scripts/check-frames.mjs < capture.sse` can count ready results in a saved stream, but two results do not prove delivery of that ID. If the row exists but the stream does not deliver it, check that the query returns `collection.Observe()` (or `collection.Observe(author => author.Name == name)` for a name filter), not a materialized list. Subscribe to the server observable before repeating the write with a fresh test ID and check whether it emits the updated row. To isolate Mongo, open a watch on the query's collection in the reader's tenant database before writing. For a query filtered by name, a probe is `db.authors.watch([{$match: {'fullDocument.name': 'Aster'}}], {fullDocument: 'updateLookup'}).next()`. Use the query's stored field names and BSON values; use `db.authors.watch().next()` for an unfiltered query. Correlate the emission with the test ID. If the watch does not emit, check replica set or sharded-cluster support; if only the watch emits, check the query's observation and predicate.
4. If curl gets the update, inspect the browser's network connection to `/.cratis/queries/ws` or `/.cratis/queries/sse`. For WebSockets, enable `app.UseWebSockets()` before `app.UseCratis()` in `Program.cs`. Check for the same ID in the delivered data before changing the React component.

## When it goes off the usual path

- **Updates stop after an identity change:** use the [account-switch reconnection](../cratis-arc-react-bind-slice/SKILL.md) after credentials change. If delivery still stops, check whether the [emission guard](../cratis-arc-authorize-request/SKILL.md) denies the new caller.

## Avoid

- Do not use `waitForFirstResult=true` for this probe; it stops after the first result.
- Do not use `/.cratis/queries/health` to check that the author document exists; it describes connections.
- Do not require a delta on the first result. It is a snapshot; later delta deliveries need a stable `Id`.
- Do not reconnect between registration and inspection; a new subscription starts with a fresh snapshot.

## Related skills

- [Connect the Mongo reader](../cratis-arc-connect-storage/SKILL.md)
- [Expose the observable query](../cratis-arc-expose-query/SKILL.md)
