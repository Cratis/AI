---
name: cratis-arc-diagnose-live-query
description: Finds where a live query stops updating. Use when an observable query connects but its results do not change after a command. Not for implementing the query (use cratis-arc-expose-query).
compatibility: Requires curl and Node.js for the stream check, and a running Library host.
---

# Find the missing author update

Trace one [RegisterAuthor](../cratis-arc-declare-command/SKILL.md) on one existing [AllAuthors](../cratis-arc-expose-query/SKILL.md) subscription. Use the same authenticated caller, tenant and database throughout.

1. From the skill directory, open the direct query at the host's listening address, with the same credentials used for the query in the browser. The example assumes HTTPS port 5001, prefix `/api`, one namespace segment skipped and authentication already configured for curl. Substitute the running host's origin if different:

   ```sh
   curl -sN --max-time 60 -H 'Accept: text/event-stream' https://localhost:5001/api/features/authors/listing/all-authors | node scripts/check-frames.mjs
   ```

2. The script counts ready frames, not their contents. Wait for `Ready result 1`. In another terminal, register Aster once using the same curl credentials and tenant. Keep the printed ID for the database check:

   ```sh
   id=$(node -p "require('node:crypto').randomUUID()")
   printf 'Author ID: %s\n' "$id"
   curl -sS -X POST https://localhost:5001/api/features/authors/registration \
     -H 'Content-Type: application/json' \
     -d "{\"id\":\"$id\",\"name\":\"Aster\"}"
   ```

   Require `"isSuccess": true` in the response before looking for a query update. The route assumes `IncludeCommandNameInRoute: false` as in [Generate proxies](../cratis-arc-generate-proxies/SKILL.md).

   With the [Mongo settings](../cratis-arc-connect-storage/SKILL.md) from the Library example, the default tenant uses `library` and the camel-case pluralized `Author` collection is `authors`. Run `mongosh 'mongodb://localhost:27017/library' --quiet --eval 'db.authors.find({name:"Aster"}, {_id:1,name:1}).toArray()'` and compare the returned `_id` with the command ID. For a named tenant using Arc's default database resolver, substitute `library+<tenantId>` in the database path. If the matching document is missing, check the [projection](../cratis-chronicle-project-view/SKILL.md) before debugging delivery.
3. If the document exists but no `Ready result 2` arrives, check that Mongo supports change streams (replica set or sharded cluster) and that `Features/Authors/Listing/Author.cs` returns `collection.Observe()`, not a materialized list.
4. If curl gets the update, inspect the browser's network connection to `/.cratis/queries/ws` or `/.cratis/queries/sse`. For WebSockets, enable `app.UseWebSockets()` before `app.UseCratis()` in `Program.cs`. Check for the same ID in the delivered data before changing the React component.

## Avoid

- Do not use `waitForFirstResult=true` for this probe; it stops after the first result.
- Do not use `/.cratis/queries/health` to check that the author document exists; it describes connections.
- Do not require a delta on the first result. It is a snapshot; later delta deliveries need a stable `Id`.
- Do not reconnect between registration and inspection; a new subscription starts with a fresh snapshot.

## Related skills

- [Connect the Mongo reader](../cratis-arc-connect-storage/SKILL.md)
- [Expose the observable query](../cratis-arc-expose-query/SKILL.md)
