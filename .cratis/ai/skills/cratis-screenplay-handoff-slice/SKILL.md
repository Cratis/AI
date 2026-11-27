---
name: cratis-screenplay-handoff-slice
description: Use when a modeler needs to hand an accepted Screenplay slice, scoped export and target obligations to an implementer. Not for approving the model (use cratis-screenplay-accept-model).
compatibility: Requires the Screenplay CLI.
---

# Hand off Library author registration

1. Start in the application directory containing `model/Authors/registration.play`. Confirm [acceptance](../cratis-screenplay-accept-model/SKILL.md) covers this exact revision and identify the target Library application before exporting.
2. Export the full model and the registration-only excerpt, then copy the top-level `revision` field from each JSON file. Label the values **full model** (`library.json`) and **registration excerpt** (`registration.json`). If a file is unavailable, give its export command and field to read instead of guessing the value:

   ```sh
   screenplay export model --output library.json
   screenplay export model --scope Library.Authors.RegisterAuthor --output registration.json
   ```

3. For a slice-only handoff, give the reader `registration.json`, the accepted full-model revision, the excerpt revision and the accepted example addresses and outcomes. Check the excerpt for the definitions it references. An export keeps application-level declarations but does not bring in other slices; supply any needed definitions from separate scoped exports. Name cross-slice checks such as `Library.Authors.ListAuthors` separately from the registration contract. A renderer that takes `.play` source needs the accepted model folder and identity state, plus `screenplay.lock` and its restored contracts when extensions are used. An excerpt alone is not that input.
4. Add a UI export (`screenplay export model --format ui --output screens.json`) for a screen consumer. Add the HTTP contract below for a client integrating over HTTP.
5. List the target checks for the implementer: Aster appears in the open list under the agreed ID; a blank name produces `Name is required` and no new row. Map each check to its accepted example. Leave execution pending.

## Hand off to an HTTP client

For a registration-only client, run `screenplay export model --scope Library.Authors.RegisterAuthor --format openapi --output api.json`. Omit `--scope` only when the client needs the full application contract. Under `paths`, locate the operations in scope. For each, include the HTTP method and path, `operationId`, and `x-screenplay-id` in the handoff.

With the default model conventions, the execution operation is `POST /api/library/authors/register-author` with ID `Library.Authors.RegisterAuthor.RegisterAuthor`. Validation appends `/validate` to that path and `.Validate` to that ID; both share the command's `x-screenplay-id`. A separate listing contract includes `GET /api/library/authors/list-authors/all-authors` with ID `Library.Authors.ListAuthors.AllAuthors` and its own artifact ID; it is not in the registration-only export. Copy the artifact IDs from the export. If it is unavailable, identify the fields to extract and leave their values pending.

Treat those IDs as model metadata. Arc's generated OpenAPI uses the host's endpoint names as `operationId` (for example, `ExecuteLibrary.Features.Authors.Registration.RegisterAuthor`), not the Screenplay operation IDs. Get `x-screenplay-id` from the Screenplay export, not Arc. Confirm the target host's method, path and operation ID against its own OpenAPI before writing client requests.

| Arc client intent | Request on the confirmed host route | Expected result |
|---|---|---|
| Validate `RegisterAuthor` | `POST <command-route>/validate` with the command JSON | Runs authorization and validation, not the handler; no registration is recorded, even for valid input. |
| Execute `RegisterAuthor` | `POST <command-route>` with the same JSON | Runs the handler when authorized and valid. Check the command result and the registration outcome. |
| Read one `AllAuthors` snapshot | `GET <query-route>?waitForFirstResult=true` without a stream header or upgrade | One JSON query result, not a subscription. Without `waitForFirstResult=true`, an observable query can answer 202 with `isReady: false` and no data. |
| Follow `AllAuthors` live | `GET <query-route>` with `Accept: text/event-stream` | Keep the connection open for later results; the first streamed result alone does not verify live delivery. |

The model's `x-screenplay-observable` marks a live query; the plain `GET` and stream negotiation above describe Arc's runtime behavior. For HTTP delivery, include this one-off target check: validating valid input adds no row; executing it puts the agreed ID in both the fresh snapshot and the open stream.

## When it goes off the usual path

- **The compiler accepts a feature that the renderer cannot deliver:** record the compiler and renderer versions and the selected target. Assign one owner and one target check per unrendered behavior. Don't weaken the accepted outcome or edit renderer-managed files to make the handoff look complete.

## Related skills

- [Declare the model slice](../cratis-screenplay-declare-slice/SKILL.md) for its qualified name.
- [Render the accepted slice](../cratis-stage-render-slice/SKILL.md) to preview generated changes and assign target gaps before publication.
- [Deliver the slice](../cratis-platform-deliver-slice/SKILL.md) for the running application check.
