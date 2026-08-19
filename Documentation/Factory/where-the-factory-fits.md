# Where the Factory fits

Research for issue #54, done before designing its experiment. The owner rejected the framing
that pits the Factory against Studio and named four value propositions the issue does not
capture. This records what the code says about them, with evidence, so the experiment tests
something real.

Everything below was read from source in sibling repositories. Those repositories were never
modified.

## The finding that reframes the issue

**Studio already implements the seam this repository was speculating about, and names it in
almost the same words the owner used.**

Studio generates a slice in two stages. First `SliceCodeGenerator.Generate()`
(`Studio/Source/Core/.../Slices/CodeGeneration/SliceCodeGenerator.cs:53-91`) renders
deterministically through `Cratis.Stage.Rendering.Cratis`. Then, if the slice has an assigned
agent, it calls `ISliceCodeAugmenter.Augment(...)`, whose own doc comment reads: *"lets a
slice's assigned AI agent refine statically generated code."*

The prompt it sends, verbatim from `SliceCodeAugmenter.BuildInstructions`:

> "You are refining the statically generated C# code for the vertical slice '{name}'. Improve
> the implementation so it fully realizes the slice's intent: **fill in gaps the static
> rendering left**, keep the Cratis Arc + Chronicle conventions the code already follows, and
> change nothing that does not need changing."

So "Studio does the deterministic part and calls something else to fill the blanks" is not a
hypothesis to be tested. It is shipped behavior. The open question is not *whether* that seam
exists but *what quality of agent* stands behind it --- and that is a question this
repository's corpus and Factory are directly about.

The class remark is worth recording too, because it shows the design already survives a bad
model call: *"A model call fails often enough... The static rendering already landed, so a
failed refinement degrades to 'no refinement.'"*

## The blanks are enumerated in code, not guessed

The deterministic renderer publishes a machine-readable list of what it refuses to produce.
`Stage/Source/Rendering.Cratis/UnrenderedConstructs.cs:20-38` names the families it reports as
diagnostics instead of rendering, including `screens` (*"the rendered application has no user
interface"*) and `captures` (*"no ingestion of the captured source is rendered"*), plus
reducers, query narrowing, file-backed constraints, and any second command/projection/read
model beyond the first.

The renderers mark the rest inline:

| Blank | Where | What is emitted |
|---|---|---|
| Reaction body referencing a file | `Renderers/ReactionSliceRenderer.cs:145` | `throw new NotImplementedException();` |
| Reaction body not authored at all | `Renderers/ReactionSliceRenderer.cs:149` | `// TODO: implement...` + `return null;` |
| `where` clause narrowing a reaction | `Renderers/ReactionSliceRenderer.cs:99` | dropped, with a `// TODO` |
| Clock / schedule / integration trigger | `Renderers/ReactionSliceRenderer.cs:107-119` | unrenderable, diagnostic only |
| Event argument whose source path is absent | `Renderers/StateChangeSliceRenderer.cs:196-217` | `default!` plus a diagnostic |
| Unresolved validation, localization, projection blocks | `Expressions/ExpressionRenderer.cs:49`, `Renderers/ConceptRenderer.cs:153,164` | `// TODO:` |

This matters more than the individual entries. **The long tail is addressable rather than
vague.** A generative layer does not have to guess where it is needed; the deterministic pass
says so, in the output and in diagnostics. That is a far better substrate for both an
experiment and a product than "AI writes the hard parts."

There is no frontend anywhere in this path: `Rendering.Cratis` emits no React, so a slice's UI
is entirely unrendered by construction.

## The seam is reachable from outside Studio, over MCP

Studio ships an MCP server (`Studio/Source/Mcp`, added 2026-08-18 in `828b27a5f`, *"Add the MCP
server, reaching Studio in one organization"*). It exposes the model-shaping tools one would
expect --- `studio_create_event_model`, `studio_add_module`, `studio_add_feature`,
`studio_add_state_change_slice`, `studio_add_state_view_slice`, concept and brainstorming
tools, `studio_locate`, `studio_whoami`, structure and catalog queries.

**None of those is a code-generation tool, and it would be easy to conclude the generation seam
is unreachable from outside. That conclusion is wrong.** `studio_execute_command`
(`Source/Mcp/Tools/CatalogTools.cs:93`) is a generic dispatcher over the entire generated
command catalog:

```csharp
var result = await api.ExecuteRoute(command.Route, arguments, cancellationToken);
```

That catalog (`Source/Core.Api/Generated/StudioApiCatalog.Commands.g.cs`) carries the whole
public API surface, including `AssignSlice` and `MarkSliceReadyForImplementation`. So an
external caller can assign an agent to a slice and then mark it ready, which raises
`SliceMarkedReadyForImplementation`, which `SliceCodeGenerationTrigger` consumes, which calls
`SliceCodeGenerator.Generate`, which calls `ISliceCodeAugmenter`. **The augmentation seam is
reachable over MCP today** --- not through a dedicated tool, but through the catalog.

Studio's own README states the design intent plainly, and it is stronger than "an external
agent is permitted":

> "Studio's own agents come through here too... When somebody asks Studio to carry something
> out... Core does not reach into itself. It asks this server, over the public host, with the
> organization's own client credentials, exactly as an outside agent would."

Studio's internal generation flow and an external agent are deliberately **the same code path
with the same security boundary** --- a follow-up commit, `0c1cbafac` (*"Reach Studio's own
tools the way anybody else's agent does"*), is precisely the change that folded Studio's
internal path onto this server. It is served as its own container on `mcp.cratis.studio`,
authenticated with per-organization client credentials through AuthProxy.

This removes the main technical objection to value proposition 3. Studio does not need to add
a route for an external Factory to participate; the route exists, is public, is authenticated,
and is the same one Studio uses itself.

## What the Factory actually is today

Measured, not assumed --- and it is not what the name suggests.

**The Factory governs generation; it does not generate.** Nothing in `Factory/scripts` emits
C# or TSX. There is no template engine, no source writer, and no model call in the repository.
The one `generate_*` function, `artifact_provenance.generate_agent_context_integrity_only`
(`Factory/scripts/artifact_provenance.py:185`), builds a fixed JSON agent-context document
through a hardcoded allowlist. `harness_request.build_harness_request`
(`Factory/scripts/harness_request.py:57-118`) assembles the JSON payload a harness *would*
send to an external agent. Generation is deliberately outside the boundary:
`Documentation/Factory/cli-boundary.md` lists *"Agent sessions, prompts, skills, or model
rosters"* and *"Sandbox/worktree orchestration"* under **what never enters the CLI**.

Runnable today, each an argparse CLI under `Factory/scripts/`: `resolve_factory.py` (pick a
profile from repository evidence), `compile_factory.py` (compile workflow + profile + policy
into an ordered, capability-granting plan), `preflight_factory.py` (git state and output-path
safety), `validate_factory.py` (schema and semantic validation), `evaluate_factory.py` (run
the evaluation catalog). The suite is **311 tests, 6 skipped, green** --- the previously
recorded 292 was stale.

The only shipped workflow, `Workflows/investigate-cratis-issue.factory.json`, is read-only by
construction: every phase carries `policy.writeScopes: []`. Its phases run
`accept-intent` (human) then `investigate` (agent), `verify-workspace` (code),
`review` (agent) and `accept-result` (human). **No workflow in the repository produces a
vertical slice.**

Evaluations reflect that. `Evaluations/Factory/foundation.catalog.json` holds 11 fixtures, 12
executions and 42 cases, but execution kinds are exactly `{resolve, preflight}`, and 30 of the
42 cases are rubric-only prose. Today "the Factory did well" means *it resolved correctly*,
*it compiled a valid workflow*, or *it preflighted safely* --- never *it produced correct
code*.

The .NET port mirrors 4 Python areas (`Canonicalization`, `Definitions`, `Hashing`,
`SchemaValidation`). `Source/Factory.Cli`, `Factory.Evaluations`, `Factory.Worker`,
`Factory.Worker.Pi` and `Source/Planner/Factory` do not exist on disk; `Factory/README.md:60-90`
marks them planned and says implementation is *"on hold."* There is no `cratis-factory` binary.

## What this means for the four value propositions

1. **Internal maintainer tooling** --- plausible and *nearest to shipping*, because governance
   is exactly what exists. Resolution, compilation, preflight and provenance are the parts
   already built and tested, and working across many repositories is a governance problem
   before it is a generation problem.
2. **Developers who do not want Studio** --- unaffected by any of this. Their AI path today is
   this repository's corpus read by a general coding agent. That path is real and already in
   use; the Factory would add governance to it, not capability.
3. **Studio as a consumer** --- **confirmed in code, and stronger than stated.** The seam
   exists, is invoked automatically after rendering, and degrades safely when the model call
   fails. It is **not** Studio-internal: `studio_execute_command` reaches `AssignSlice` and
   `MarkSliceReadyForImplementation` over MCP, and Studio's own agents deliberately use that
   same public path. No new route is needed for an external Factory to participate.
4. **The long tail beyond deterministic reach** --- **confirmed and, unusually, enumerated.**
   `UnrenderedConstructs.cs` plus the inline TODO and `NotImplementedException` sites are a
   published contract of what determinism cannot reach.

## What an experiment can honestly test

The control condition already exists: a well-instructed agent reading this corpus. That is how
work is done in these repositories today.

The treatment condition does not. To run "Factory-generated slice versus well-instructed
agent," four things would have to be built: a workflow with a write-capable phase that invokes
a coding agent and captures output; an evaluation execution kind for generated code (build,
specs, conventions) since the evaluator understands only `resolve` and `preflight`; the
harness-to-agent wiring, which is the on-hold `Factory.Worker`; and a scoring rubric.

**A cheaper and more honest experiment follows from the research.** The blanks are enumerated,
so the question worth asking first is not "can the Factory beat an agent at writing a slice?"
but **"given a deterministically rendered slice with its holes marked, how well does an agent
fill exactly those holes, and does corpus quality change the answer?"** That test needs no
write-capable workflow and no worker: render or hand-construct a slice with known blanks, have
agents fill them, and measure against the specs. It measures the seam that Studio already
ships, it directly exercises the claim that the corpus is the specification of the developer,
and it produces evidence usable by Studio whichever way the Factory itself goes.

**And the MCP server makes a second, end-to-end variant possible that was not before.** Because
`studio_execute_command` reaches `AssignSlice` and `MarkSliceReadyForImplementation` over an
authenticated public endpoint, a real run can be driven from outside Studio: create or select a
model, trigger generation, and compare the augmented result against the same slice filled by an
agent working from this corpus alone. That is the actual product question --- *does governed,
corpus-instructed augmentation beat ad-hoc augmentation at the seam Studio already ships* ---
rather than a synthetic head-to-head that no shipping path would ever run.

The cheap variant should still come first: it needs no credentials, no organization, and no
network, and its result determines whether the end-to-end run is worth arranging.

## Measured by running it: the blocker is one named component

The section above said a generation experiment would need four things built: a write-capable
workflow, a code-output evaluation kind, the harness-to-agent wiring, and a rubric. Building
the first of those turned the estimate into a measurement, and it is smaller than it looked.

`Workflows/complete-rendered-slice.factory.json` and the `propose-slice-patch` capability were
added as **definitions only** --- no script changed. Almost everything they need already
existed and was unused: the workflow schema accepts write scopes, the capability schema already
admits `effect: "write"`, compiler and preflight already propagate and report scopes per phase,
and `local-development.policy.json` already allows `propose-source-patch`.

Chased end to end against a fixture repository, the chain gets all the way to compilation:

| Step | Result |
|---|---|
| `resolve_factory.py --purpose implement-vertical-slice` | **success** --- route: agent `slice-implementer`, workflow `complete-rendered-slice` |
| `preflight_factory.py` with `writeScopes: ["Source/**"]` | **blocked** at the time of writing |
| the same phase with `writeScopes: []` | **success** --- authoritative compiled plan |

> Phase complete-slice requests writeScopes, but Stage 0 has no trusted scope-to-capability
> policy evaluator; non-empty scopes remain blocked

That was a deliberate boundary, not an oversight. Toggling the scope empty and back isolated it
exactly: **everything in the chain worked except granting write.**

So the blocker for #54 was **one named component --- a trusted scope-to-capability policy
evaluator** --- and not the worker host or the .NET port that the issue's declared dependencies
point at. **That component now exists**; the section below records what it decides.

## The scope evaluator, and what it decides

`compile_factory._evaluate_phase_scopes` replaces the blanket refusal on the compile path. It
runs **after** capability grants are resolved, so it can judge a requested scope against the
capabilities the phase actually holds under the policy it compiles with.

A non-empty `writeScopes` is permitted only when **all** of the following hold.

1. **Some granted capability may write.** At least one grant has `effect` of `write` or
   `destructive`. A phase holding only read-effect capabilities cannot receive write scope, and
   a capability whose `policyCapability` does not resolve to `allow` never becomes a grant at
   all --- so it cannot carry scope either.
2. **Every scope is a usable repository-relative path.** Absolute paths, `..` traversal, `~`
   home references, drive or scheme separators, backslash separators, empty or non-normalized
   segments, control characters, and paths beyond 64 segments are each refused with the reason
   named. This runs before any glob comparison, so a traversal can never be normalized *into*
   an allowed answer.
3. **No scope can reach a protected path.** Refusal is by **glob intersection**, not by prefix
   or literal equality: a scope is refused when some path could match both it and one of the
   policy's `protectedPaths`. `.ai/**` and `Factory/**` are refused for the obvious reason, and
   so are `*/**`, `.a?/**`, and `.AI/**`, which reach a protected path only through a wildcard
   or a case difference. Comparison is case-insensitive because the case-preserving,
   case-insensitive filesystems this runs on would otherwise honor `.AI/**` as `.ai/**`.
   A scope that merely *looks* adjacent, such as `.aiAdjacent/**`, is allowed.

`networkScopes` and `secretScopes` stay refused, now for a stated reason rather than a blanket
one: the policy schema defines no network or secret vocabulary to evaluate them against. Adding
that vocabulary is a policy-schema change, not a compiler change.

Two guards sit in front of this one and are worth not confusing with it. `validate_factory`
already refuses a repository-wide agent write scope (`.`, `**`, `**/*`) as a workflow-authoring
error, so those never reach the evaluator. And because the evaluator runs inside
`compile_documents`, it also runs during `verify_compiled_workflow_integrity`'s deterministic
recompilation --- so a compiled plan whose scope was edited after the fact fails verification
rather than being honored.

### Three things only running the tools revealed

- **The Factory cannot preflight its own repository.** Executable preflight rejects git mode
  `120000`, and this repository carries **102 tracked symlinks** --- the corpus adapters from
  `3f3f151`. Any experiment must run against a repository without symlinked corpus adapters, or
  preflight has to learn about them first.
- **Profiles with `activation: "explicit"` need a `.cratis/factory.json`** opting them in, which
  is how a consuming project would do it. `cratis-dotnet-react` --- the full-stack profile, and
  the only one recommending `slice-implementer` --- is one of these.
- **A workflow is only reachable when a profile recommends it for a purpose that an agent also
  serves.** The purpose vocabulary is real and already populated: `implement-vertical-slice`
  existed with `slice-implementer` behind it, so the workflow adopted that rather than inventing
  a purpose.

The resolver's diagnostics named the missing piece at every step rather than failing vaguely,
which is the only reason this was traceable without reading the compiler first.

## Not verified

- Nothing here was executed. Studio and Stage were read, never built or run. The augmenter's
  behavior in practice --- how good the refinement actually is --- is unmeasured, and it is the
  single most decision-relevant unknown.
- `Rendering.Cratis` is well specified (83 spec files across 21 `for_*` folders) but **no
  shipping path references it for code generation**; Stage's own host interprets the model at
  runtime instead. Whether Studio's use of it is a primary path or an experiment was not
  established.
- The Factory's Python suite was run (311 pass at the time; 324 after the scope evaluator
  landed); no .NET build or test was attempted.
- The scope evaluator decides what a plan may *request*. Nothing yet **enforces** that an
  executing agent writes only inside its granted scope --- that belongs to the worker host,
  which is still on hold.
- No claim here rests on documentation badges or marketing copy, after an earlier session drew
  a wrong conclusion about Studio's maturity that way.
