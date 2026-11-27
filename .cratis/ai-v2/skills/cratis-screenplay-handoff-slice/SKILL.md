---
name: cratis-screenplay-handoff-slice
description: Use when exporting one accepted Screenplay slice to hand a target team the application behavior to implement. Not for approving the model (use cratis-screenplay-accept-model).
compatibility: Requires the Screenplay CLI.
---

# Hand off Library author registration

1. Start in the application directory containing `model/Authors/registration.play`. Run the [acceptance checks](../cratis-screenplay-accept-model/SKILL.md) and identify the target Library application before exporting.
2. Export the full model and the registration-only excerpt, then copy the top-level `revision` field from each JSON file. Label the values **full model** (`library.json`) and **registration excerpt** (`registration.json`). If a file is unavailable, give its export command and field to read instead of guessing the value:

   ```sh
   screenplay export model --output library.json
   screenplay export model --scope Library.Authors.RegisterAuthor --output registration.json
   ```

3. Give the implementer `registration.json`, both revisions and the accepted `RegisteringAster` and `RejectingAnEmptyName` outcomes. Name `Library.Authors.ListAuthors` as a dependency, not as part of this excerpt.
4. For a screen consumer, include `screenplay export model --format ui --output screens.json`. For an HTTP consumer, use the handoff below.
5. On the target, register Aster for the agreed author ID and verify that the already-open list gains the matching row. An empty name must produce `Name is required` and no new row.

## Hand off to an HTTP client

Run `screenplay export model --format openapi --output api.json` on the full model so both registration and listing are present. Under `paths`, locate the execution, validation and query operations. For each, include the HTTP method and path, `operationId`, and `x-screenplay-id` in the handoff.

With the default model conventions, the execution operation is `POST /api/library/authors/register-author` with ID `Library.Authors.RegisterAuthor.RegisterAuthor`. Validation appends `/validate` to that path and `.Validate` to that ID; both share the command's `x-screenplay-id`. The query is `GET /api/library/authors/list-authors/all-authors` with ID `Library.Authors.ListAuthors.AllAuthors` and its own artifact ID. Copy the artifact IDs from the export. If it is unavailable, identify the fields to extract and leave their values pending.

Treat those IDs as model metadata. Arc's generated OpenAPI uses the host's endpoint names as `operationId` (for example, `ExecuteLibrary.Features.Authors.Registration.RegisterAuthor`), not the Screenplay operation IDs. Get `x-screenplay-id` from the Screenplay export, not Arc. Confirm the target host's method, path and operation ID against its own OpenAPI before writing client requests.

| Arc client intent | Request on the confirmed host route | Expected result |
|---|---|---|
| Validate `RegisterAuthor` | `POST <command-route>/validate` with the command JSON | Runs authorization and validation, not the handler; no registration is recorded, even for valid input. |
| Execute `RegisterAuthor` | `POST <command-route>` with the same JSON | Runs the handler when authorized and valid. Check the command result and the registration outcome. |
| Read one `AllAuthors` snapshot | `GET <query-route>?waitForFirstResult=true` without a stream header or upgrade | One JSON query result, not a subscription. Without `waitForFirstResult=true`, an observable query can answer 202 with `isReady: false` and no data. |
| Follow `AllAuthors` live | `GET <query-route>` with `Accept: text/event-stream`, or a WebSocket upgrade on that route | Keep the connection open for later results; the first streamed result alone does not verify live delivery. |

The model's `x-screenplay-observable` marks a live query; the plain `GET` and stream negotiation above describe Arc's runtime behavior. Verify with valid input: run validation first and confirm no new row, then execute and confirm the fresh snapshot and the already-open stream both contain the agreed author ID.

## Avoid

- Don't send a feature-wide export when the request is for one slice.
- Don't treat a successful export as proof that the target application implements registration.

## Related skills

- [Declare the model slice](../cratis-screenplay-declare-slice/SKILL.md) for its qualified name.
- [Deliver the slice](../cratis-platform-deliver-slice/SKILL.md) for the running application check.
