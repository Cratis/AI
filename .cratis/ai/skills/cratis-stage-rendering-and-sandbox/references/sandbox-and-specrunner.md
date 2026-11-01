# The `cratis/stage` sandbox and the `cratis/stage-specrunner` job

## Contents

- The sandbox: a partial, disposable runtime
- Protected command reads
- Date comparisons (v26)
- Implementation bodies and authored occurrence
- Refusals shared by both engines
- The specification runner
- Choosing between them

Docker is required for both. Each image runs the Stage host or runner on a mounted model;
neither is a generated application.

## The sandbox: a partial, disposable runtime

`cratis/stage` is the Stage host plus an in-memory Chronicle kernel. Each session starts
empty and leaves nothing behind. It is for playing a model, not a generated application
and not a test of one.

```bash
cratis run ./model                 # folder or a single .play file
cratis run --port 9191 --workbench-port 35001
docker run --rm -p 127.0.0.1:9090:9090 -p 127.0.0.1:35000:35000 \
    -v "$PWD":/eventmodel:ro cratis/stage:latest
```

`cratis run` mounts only the selected file or folder, read-only, and defaults to the
Stage version the CLI renders with (`--tag` overrides). The Stage API and the Scalar
reference (`/scalar/v1`) are on `9090`; the Chronicle Workbench is on **`https://`**
port `35000` (a plain `http://` request gets no reply; the certificate is self-signed).
The entrypoint takes a model file or folder, default `/eventmodel`. Deployment settings
come from `cratis-stage.json` (path override `STAGE_CONFIG`), not `appsettings.json`.
Implementation `file` references stay symbolic: the sandbox never opens them.
Requires Cratis CLI 3.64.0 for `--engine`; from CLI 3.73.0 `cratis run` runs the `semantic` engine by default and always passes `Stage__Runtime__Engine`, while older CLIs default to `eventmodel`. The EventModel engine is legacy and refuses newer constructs (for example v27 composite keys); do not rely on it. Running the image directly, the environment setting below selects the engine.

Two engines:

| Engine | Selected by | Behaviour |
| --- | --- | --- |
| EventModel (legacy; the image's default) | nothing | Commands evaluate their modeled `produces` mappings, append the facts to Chronicle and echo the payload. **Only part of modeled validation is enforced, and no authorization.** See [What the EventModel engine enforces](#what-the-eventmodel-engine-enforces). It registers Chronicle projections. Named event sources, streams and routes are refused with `STAGE-ESM-030` (`/stage/status` reports `state: "unsupported"` and `/api/**` answers 501), so a routed model does not run here |
| Semantic (`cratis run`'s default) | `Stage__Runtime__Engine=semantic` | Evaluates validation, requirements, authorization, conditional production and constraints before accepting a command; appends one batch; denied is HTTP 403, validation or constraint failure HTTP 400, an unsupported command HTTP 501. `GET /stage/semantic/admission` lists what is admitted. Executes routes and event-triggered reactions (including `where`, `runs as`, `from`, productions, invocations and cascades), settling them with the initiating command in one batch. Refuses a model it cannot execute (`state: "unsupported"`, `/api/**` returns 501). Read models are in-process, not Chronicle projections in the Workbench; the history is unbounded, so use it for short sessions |

Do not read an answering sandbox as evidence of correct authorization. Callers are
built from unsigned `x-ms-client-principal` headers that anyone who can reach the host can
forge, the EventModel engine enforces no authorization, and the session should stay private (loopback
ports or an authenticated proxy). Rendered applications use the renderer's admitted Arc
authorization instead, which is the thing to test for production behavior (Debug tests
of a render, [render-example.md](render-example.md)).

`Stage__Sandbox__ForwardedIdentity=true` (`Stage:Sandbox:ForwardedIdentity`) is the exception:
the sandbox runs behind AuthProxy, trusts the identity it forwards and plays no persona, so the
signed-in caller is the caller authorization runs for. It overrides `Stage:Sandbox:Identity`.
`cratis run` sets it when the model declares `authentication`; set it yourself only behind an
AuthProxy, because the headers are unsigned and anything that can reach the sandbox directly
can forge them. <!-- version: fill after release -->

The semantic Host encrypts personal-data and secret concepts at rest through Chronicle and
releases values on read; erasure deletes event-source keys. Encryption applies to new
writes only: events already stored in plaintext in an existing Play store are not
retroactively encrypted, and key deletion is not erasure of those earlier plaintext events.
It does not supply explicit subject lineage. Non-text `secret` concepts render/run in their original types
(Requires Stage 4.96.0); older engines report `STAGE-ESM-041`. `pii secret` uses PII only. It executes equality filters, but its specification executor refuses filtered
query assertions with `STAGE-ESM-010`.

The semantic Host exposes `POST /stage/semantic/specifications/run`, running fresh isolated
scenarios in a child process, never the live world or log. Read every report outcome: HTTP
200 is not a specification pass. Cancellation kills the child tree; a timeout is 504, a
launch failure, nonzero exit or invalid report is 502. The timeout defaults to 120 seconds
(1–600, including queue); specifications stay available after a later world-rebuild or
registration failure if the model was admitted.

### Semantic text rules versus the default syntax engine

The semantic Host/specification executor admits v24 literal `contains`, `not contains`,
`starts with` and `ends with` rules as ordinal UTF-16 comparisons; absence passes.
Empty operands pass contains/starts/ends and fail not-contains for present text.
The legacy EventModel engine drops these rules: its list below is not evidence
of semantic support. Generated applications render these comparisons without regex.

### What the EventModel engine enforces

When a command that declares at least one `produces` executes, the EventModel engine
refuses it with a validation result naming the property, and appends nothing, if:

- a property the command's schema requires is missing or `null`;
- a top-level property breaks a declarative `validate` rule with a literal operand:
  `not empty`, `matches "<regex>"`, `length == <n>`, `min <n>` or `max <n>` on text, or
  `>`, `>=`, `<`, `<=` on a number.

Some rules are checked with the wrong meaning:

- `min` and `max` on a number are checked as the length of the number's text, so
  `quantity min 1` accepts `0` and `quantity min 2` refuses `9`;
- `not empty` on a nested property (`address.name`) refuses every payload, including a
  valid one, because the dotted path is looked up as a top-level key; other rules on
  nested properties are skipped.

Everything else passes unchecked:

- `all >` and `all >=` over element paths;
- `==` and `!=`, `matches email`, `rule <Name>`, and any rule whose operand is another
  property or a value resolved at run time, such as `today`;
- concept rules, `require` over read models, and uniqueness constraints;
- command `authorize` and query `authorize`;
- every check on a command without `produces`, and the `/validate` route, which runs none
  of these checks.

A refusal or an acceptance from the EventModel engine therefore proves nothing beyond the
lists above. Use the semantic engine, or Debug tests of a render, for
evidence about the rest.

## Protected command reads

Requires Stage 4.129.0 for semantic Host and specification-executor protected reads;
older engines refuse them with `STAGE-ESM-044`. The default EventModel Host and
structural runner still refuse the preamble with `STAGE-ESM-044`; the structural
runner exits `1` without a report. The Cratis renderer renders protected reads only from Stage 4.138.0 and refuses unpreservable shapes with `-044`:
executing a model here does not make it renderable.

After authorization and property/concept rules, each declared read must exist at
its key. Missing state rejects with `<View> '<key>' does not exist.` before any
requirement or generation, even a command-only requirement. `/validate` reports
absence too. Present read properties feed `require` and produced-event mappings.
The executor projects prior facts through Chronicle's in-memory read-model scenario,
preserving event-source-keyed removal and recreation. Join removals, parent keys,
children and nested scopes remain refused.

A protected command with any non-Error requirement refuses `STAGE-ESM-045` before
execution. This includes reaction-invoked commands, even a specification expecting
rejection: the outcome is `Unsupported`, before seeding facts, not a passing refusal.
Do not change modeled severity to get an executable result.

Requires Stage 4.142.0 for decide/commit against outside facts; older Hosts fault
on any outside append. The Host decides on the session world, reads the outside
suffix and commits against the extended world. A later fact matching a protected
read's key and event contracts causes a concurrency conflict without faulting the
session; unrelated facts remain for commit-time constraints and projections.
Outside facts do not fire reactions again. Refusals retain their outcome.

The root/reaction batch uses one guarded write against the durable pre-batch tail,
even for a successful empty batch. A definitive guard loss may retry the same
decision, preserving generated values, only when settlement invoked no commands.
An invocation or eight unsuccessful attempts returns a conflict. An unknown write
outcome or unreadable/unsupported outside history faults the session, never retries
as success. Legacy custom appenders without these capabilities retain conservative
checks. These are Host guarantees, not generated-application evidence.

## Date comparisons (v26)

Requires Stage 4.135.0 for v26 admission; older Stage refuses v26 with `STAGE-ESM-016`.
The semantic Host and specification executor compare `Date` as calendar days and
`DateTime` as UTC ticks in `require`, `produces when` and validation rules, including
through concepts. A participating `DateTime` input without an offset or `Z` rejects
with Validation after authorization and before any rule. `then` stays ordinal. The
Cratis renderer renders these comparisons from Stage 4.141.0; older renderers and
legacy engines refuse `STAGE-ESM-046`. Read [date comparisons](date-comparisons.md)
when checking remaining renderer refusals and input-binding differences.

One ordering differs from the reference: the reference checks authorization, then
offsets, then opaque C# validation, so an offset-less DateTime beside opaque
validation is a Validation rejection there. The specification executor refuses opaque
validation when reached at specification admission and the Host refuses a command
that reaches it before authorization, so both Stage paths report `Unsupported`,
which never counts as a pass.

## Implementation bodies and authored occurrence

Requires Stage 4.145.0 for reach-scoped reducer and validation refusals; older
semantic engines refuse unrelated behavior when any such body exists. Neither
Host nor executor runs these opaque bodies. `STAGE-IMPL-003` names the reached
owner and RequirementId. Reachability includes:

- command under test and commands invoked by reactions reach command validation;
- command input and query argument types reach concept rules through composites,
  collections and optionals;
- given, appended or produced events reach reducer transitions; read-model assertions
  and queries reach the corresponding reducer too;
- potential reaction effects are included without evaluating guards, including effects
  of an action expected to be refused.

Unrelated commands, queries and specifications remain admitted. Reducer refusals use
Projection capability; validation refusals use Command. This does not relax
live-world history rebuilding or renderer admission. Described handlers remain
refused in rendering even in Stub mode; semantic execution reports
`ImplementationBody` only when reached after their gates. See [current boundaries](current-boundaries.md).

Requires Stage 4.141.1 for authored occurrence in event-reaction specifications; older
executors refuse clocks beside reactions. Independent command, append and named-redelivery
specifications accept `given clock` at or after the Unix epoch in whole milliseconds.
Offset-bearing source clocks normalize to UTC; the same instant reaches direct/cascading
productions, invocation arguments, invoked commands and refusal productions. Redelivery
uses the scenario clock, not the given event's timestamp.

No authored clock means no reaction occurrence: a reached production using
`$context.occurred` rejects with `Reaction '<name>' uses $context, which needs the scenario's 'given clock'.`;
an invocation argument instead rejects as unresolved in its declared root scope.
A false `where` skips evaluation; the executor never invents wall time. The fixture
supplies time, not audit identity: `$eventSourceId`/`$eventContext.eventSourceId` and
`$context.causedBy.*` remain `STAGE-ESM-013`, even under `runs as system`.

Clock/application/startup/shutdown triggers and `when clock`/trigger actions
remain `STAGE-ESM-024`. Admitted `source events` capture specifications now run;
this does not execute polling or an external integration.
**A clock fixture is not a scheduler.** Generated backend
occurrence mappings use `EventContext.Occurred`, but context-dependent generated
reaction specs retain `-011`; generated append/redelivery clock fixtures retain `-024`.
Rendered clock fixtures remain command-only.

## Refusals shared by both engines

Semantic capture/publication support is target-specific: supported capture
specifications run and the live Host can run around public/foreign constructs
using local appends and seeded inbound facts, never real external publication or
polling. Unsupported Translate reactive/read-side shapes still refuse. Legacy
syntax admission retains broader refusals, including reaction identity, observer
filters and routing (`-034`, `-035`, `-036`). Clock, application, startup and shutdown reaction triggers and opaque
reaction bodies fail `-024`. See [current boundaries](current-boundaries.md).

## The specification runner

A run-to-completion job: compiles the model, checks its specifications, writes a results
file and exits.

```bash
docker run --rm -v /path/to/model:/model:ro -v /path/to/results:/output \
    cratis/stage-specrunner:latest                       # structural, deprecated
docker run --rm -v /path/to/model:/model:ro -v /path/to/results:/output \
    cratis/stage-specrunner:latest --engine semantic --application MyApplication
```

| Argument | Default | Meaning |
| --- | --- | --- |
| `--model <file-or-folder>` | `/model` | `.play` file or folder, one application |
| `--output <file>` | `/output/results.json` | Result file |
| `--slice <guid>`, `--spec <guid>` | | Structural engine only; an invalid GUID means no filter |
| `--engine semantic` | `structural` | Opt in to executable specifications |
| `--specification`, `--scope`, `--catalog`, `--application` | | Semantic engine only |

Exit codes: `0` the results file was written (read the outcomes: a failed specification
still exits `0`), `1` a missing or uncompilable input, `2` a missing required argument or an
invalid semantic option.

- **Structural** (default, deprecated, removal planned for a future major release; it
  prints a deprecation notice): verifies that the events and commands a specification
  names resolve to its slice and that modeled rules agree. Outcomes `Passed`, `Failed`,
  `Inconclusive` (not verifiable for that slice type; not a failure). It does not execute
  any slice and refuses routed models with exit `1`, writing no results file.
- **Semantic**: creates a fresh in-memory Chronicle log per specification and dispatches
  admitted commands through Arc's in-memory pipeline; supports explicit-source and routed
  given events, unconditional production, event assertions, caller and authorization,
  command rules, protected command reads (including reaction invocations), unique constraints, flat and event-source-keyed scoped projections, and
  optional snapshot queries, including protected ones: portable authorization is evaluated
  with the fixture caller, query arguments and key, and an expected denial matches only
  `then denied`. Report schema `stage-spec-run/1` with outcomes
  `Passed`, `Failed`, `Unsupported` (carrying kind, construct id and reason) or
  `Cancelled`. Not supported: given read models, conditional production, implicit identity
  allocation, external effects, composite values, queries other than optional snapshots, and
  a reached opaque authorization policy (reported as `Unsupported`). Unsupported is never a pass. Do not feed the file to a legacy reader.

The runner and generated-fixture checks use Screenplay's public
`SemanticValidationRules.Check`. This shared rule check does not execute opaque
generation or validation bodies.

How the runner relates to the verdicts: a structural pass is not a behavioral result. The
semantic engine is Stage's own executor running through Arc's in-memory pipeline. It is
not the Screenplay reference route, so a semantic pass is never V4 (V4 is reference
execution only; `cratis-screenplay-toolchain` `references/verdicts.md`) and it is not a
rendered Debug test run (V5.tests). Report its outcomes as a separate line, "Stage semantic
engine (target-engine evidence)", with the report schema counts, next to the V5 results.

## Choosing between them

| Question | Use |
| --- | --- |
| Does the model feel right as a running API? | Sandbox (`cratis run`) |
| Do the modeled specifications pass in Stage's semantic engine (target-engine evidence, not V4)? | Specification runner, `--engine semantic` |
| Does the generated code behave? | `cratis render`, then Debug build and tests of the output |
| Is authorization enforced? | Debug tests of a render and the rendered policies; never the default sandbox |
