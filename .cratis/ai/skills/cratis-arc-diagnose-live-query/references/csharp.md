# C#: trace a missing live update on an ASP.NET Core Arc host

Prerequisite: `curl`, `mongosh` and Node.js on the machine, and credentials for the same caller the browser uses. The steps trace one `RegisterAuthor` on one `AllAuthors` subscription.

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

   Require `"isSuccess": true` in the response before looking for a query update. The route assumes `IncludeCommandNameInRoute: false`, the setting used for proxy generation.

   With the MongoDB settings from the Library example, the default tenant uses `library` and the camel-case pluralized `Author` collection is `authors`. Run `mongosh 'mongodb://localhost:27017/library' --quiet --eval 'db.authors.find({name:"Aster"}, {_id:1,name:1}).toArray()'` and compare the returned `_id` with the command ID. For a named tenant using Arc's default database resolver, substitute `library+<tenantId>` in the database path. If the matching document is missing, check the projection before debugging delivery.
3. In the same stream, match the printed ID in a later successful result. `node scripts/check-frames.mjs < capture.sse`, run from the skill directory, can count ready results in a saved stream, but two results do not prove delivery of that ID. If the row exists but the stream does not deliver it, check that the query returns `collection.Observe()` (or `collection.Observe(author => author.Name == name)` for a name filter), not a materialized list. Subscribe to the server observable before repeating the write with a fresh test ID and check whether it emits the updated row. To isolate Mongo, open a watch on the query's collection in the reader's tenant database before writing. For a query filtered by name, a probe is `db.authors.watch([{$match: {'fullDocument.name': 'Aster'}}], {fullDocument: 'updateLookup'}).next()`. Use the query's stored field names and BSON values; use `db.authors.watch().next()` for an unfiltered query. Correlate the emission with the test ID. If the watch does not emit, check replica set or sharded-cluster support; if only the watch emits, check the query's observation and predicate.
4. If curl gets the update, inspect the browser's network connection to `/.cratis/queries/ws` or `/.cratis/queries/sse`. For WebSockets, enable `app.UseWebSockets()` before `app.UseCratis()` in `Program.cs`. Check for the same ID in the delivered data before changing the React component.

## When updates stop after an identity change

- **Updates stop after an identity change:** reconnect the frontend subscription after credentials change. If delivery still stops, check whether an emission guard denies the new caller.

## Avoid in C#

- Do not use `waitForFirstResult=true` for this probe; it stops after the first result.
- Do not use `/.cratis/queries/health` to check that the author document exists; it describes connections.
- Do not require a delta on the first result. It is a snapshot; later delta deliveries need a stable `Id`.
- Do not reconnect between registration and inspection; a new subscription starts with a fresh snapshot.

## Read the HTTP status of a one-shot request

A plain GET against an observable query is a snapshot request, not a subscription.

| Status | Meaning |
| --- | --- |
| 202 | No current value was readable, or a guard suppressed it. With MongoDB `Observe()` a GET without `waitForFirstResult=true` always answers 202. |
| 408 | `waitForFirstResult=true` waited (30 seconds by default) without an allowed result. |
| 500 | The source failed or completed before an allowed result. |
| 403 | A guard denied the value. |

## Direct stream or hub

The direct SSE request above subscribes to one query. The browser normally uses the multiplexed hub, where opening `/.cratis/queries/sse` subscribes to nothing: each query is added with a POST to `/.cratis/queries/sse/subscribe` and removed with `/.cratis/queries/sse/unsubscribe`. A direct stream that works therefore does not prove the hub subscription was made. The hub sends keep-alive pings; a stream that ends silently while idle points at a proxy timeout, whereas a terminal unsuccessful result is the server's answer.
