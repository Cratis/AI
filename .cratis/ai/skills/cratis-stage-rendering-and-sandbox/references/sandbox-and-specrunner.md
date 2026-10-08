# The `cratis/stage` sandbox and the `cratis/stage-specrunner` job

Read at Stage `v4.24.0` (`README.md`, `Documentation/docker/index.md`,
`Documentation/docker/spec-runner.md`, `Documentation/reference/urls.md`) and cli
`v3.28.2` (`Commands/Run/*`, unchanged since `v3.27.1`). Docker was **not run** for this skill: every behaviour here
is documented behaviour, not an observed result. Both images are still shipped.

## The sandbox: a partial, disposable runtime

`cratis/stage` is the Stage host plus an in-memory Chronicle kernel. Each session starts
empty and leaves nothing behind. It is for playing a model, not a generated application
and not a test of one.

```bash
cratis run ./model                 # folder or a single .play file; Docker required
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

Two engines:

| Engine | Selected by | Behaviour |
| --- | --- | --- |
| EventModel (default) | nothing | Commands evaluate their modeled `produces` mappings, append the facts to Chronicle and echo the payload. **Modeled validation, authorization and query authorization are not enforced.** It registers Chronicle projections |
| Semantic | `Stage__Runtime__Engine=semantic` | Evaluates validation, requirements, authorization, conditional production and constraints before accepting a command; appends one batch; denied is HTTP 403, validation or constraint failure HTTP 400, an unsupported command HTTP 501. `GET /stage/semantic/admission` lists what is admitted. Refuses a model it cannot execute (`state: "unsupported"`, `/api/**` returns 501). Read models are in-process, not Chronicle projections in the Workbench; the history is unbounded, so use it for short sessions |

Do not read an answering sandbox as evidence of correct authorization. Callers are
built from unsigned `x-ms-client-principal` headers that anyone who can reach the host can
forge, the default engine enforces nothing, and Stage's documentation says to keep the
session private (loopback ports or an authenticated proxy). The semantic engine does not
execute modeled specifications; use the runner for those. Rendered applications use the
renderer's admitted Arc authorization instead, which is the thing to test for production
behaviour (Debug tests of a render, `render-example.md`).

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

See "Specification runner exit codes" in SKILL.md.

- **Structural** (default and deprecated at Stage v4.24.2, with removal planned for the following major release): verifies that the
  events and commands a specification names resolve to its slice and that modeled rules
  agree. Outcomes `Passed`, `Failed`, `Inconclusive` (not verifiable for that slice type
  yet; not a failure). It does not execute any slice.
- **Semantic**: runs admitted commands through Arc's in-memory command pipeline with a
  fresh in-memory Chronicle log per specification; supports explicit-source given events,
  unconditional production, event assertions, caller and authorization, command rules,
  unique constraints, flat and event-source-keyed scoped projections, and unprotected
  optional snapshot queries. Report schema `stage-spec-run/1` with outcomes `Passed`,
  `Failed`, `Unsupported` (carrying kind, construct id and reason) or `Cancelled`.
  Not supported: given read models, conditional production, implicit identity allocation,
  external effects, composite values, protected queries, queries other than optional
  snapshots. Unsupported is never a pass. Do not feed the file to a legacy reader.

How the runner relates to the verdicts: a structural pass is not a behavioural result. The
semantic engine is Stage's own `SemanticSpecificationExecutor` (verified at Stage `v4.24.0`,
`Source/SpecRunner/Program.cs`), running through Arc's in-memory pipeline. It is not the
Screenplay reference route, so a semantic pass is never V4 (V4 is reference execution only;
`cratis-screenplay-toolchain` `references/verdicts.md`) and it is not a rendered Debug test run
(V5.tests). Report its outcomes as a separate line, "Stage semantic engine (target-engine
evidence)", with the report schema counts, next to the V5 results and labelled as such. How the runner behaves on ESM v4 to v6 specifications was not
verified: record it as "not run" rather than assuming.

## Choosing between them

| Question | Use |
| --- | --- |
| Does the model feel right as a running API? | Sandbox (`cratis run`) |
| Do the modeled specifications pass in Stage's semantic engine (target-engine evidence, not V4)? | Specification runner, `--engine semantic` |
| Does the generated code behave? | `cratis render`, then Debug build and tests of the output |
| Is authorization enforced? | Debug tests of a render and the rendered policies; never the default sandbox |
