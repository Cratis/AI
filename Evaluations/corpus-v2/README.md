# Executable corpus comparison

This is separate from the answer/routing/LLM-grading evaluator. `evaluate suite` implements application changes, then builds and executes specifications in an offline Docker sandbox. It does not widen the original evaluator's read-only tool policy.

## Frozen inputs

`tasks/suite.json` declares 24 tasks and a six-task pilot. All arms use identical prompts, fixture bytes, tool permissions, medium thinking, 120 tool-call/80 assistant-turn limits and 900-second trajectory timeouts. Defaults: `openai-codex/gpt-6.2-sol`, two workers, three repetitions, seed 1349. A full matrix is **216 calls**; the pilot is **18 calls**. Neither is authorized merely by running dry-run. The currently authorized smoke is one `none` trajectory only.

The application fixture is derived from **Cratis/Samples@4cbb7c9**, specifically Capstone and LearningPath/08-Production. The Screenplay library model is copied from this repository's compiled session example. Original source/license headers remain. Changes to the Samples baseline:

- One parent-selected package vector: .NET/JS Arc **24.9.0**, Components **4.63.1**, Fundamentals **7.34.5**, Chronicle **19.184.3**. The original Samples Arc 23.18.0 (.NET)/22.186.2 (JS), Fundamentals 7.34.4 (.NET) and Chronicle 19.183.2 pins are deliberately replaced. No Arc 25 dependency is used.
- Explicit Arc/Chronicle packages replace the `Cratis` umbrella reference; proxy generation remains enabled in Capstone.
- The existing **Cratis.Specifications.XUnit.v3 5.3.0 / xunit.v3 4.0.2** executable specification project remains the runner. `dotnet run` executes it; successful compilation alone is not a spec pass.
- Offline NuGet configuration, disabled NuGet audit (network is unavailable during trials), an exact npm lock with the compatible vector, Node types and a frontend environment preflight spec.
- SDK 11.0.100, Node 24 and standalone Screenplay.Tool 6.43.0 in the dependency image. The built image's immutable Docker ID, every fixture/scorer byte digest, selected stage digests, schedule and options are locked per run. Keep that image to reproduce/resume a run; rebuilding mutable base-image tags creates a different input.

No host repository, Docker socket, credentials, home, hidden scorers or competing corpus is mounted into a trial. Pi authentication remains on the host. Its only tools are the explicit trusted extension's read/write/edit/bash delegates to a non-root, network-none, read-only-root container with resource limits. Only the mutable fixture and the selected read-only corpus are mounted. `none` gets neither. Every generation process in the container is stopped before scoring; hidden C# contracts are copied only afterwards. Do not treat a temporary cwd alone as sandboxing.

## Commands

Run from the repository root. All costly checks use `pi-phase`, never bypass its admission guard. With ample disk space (40 GiB preferred), prepare the dependency image **before** trials; network access here is intentional:

```sh
~/.pi/agent/bin/pi-phase run --kind build --label corpus-v2-image --queue-timeout 3600 --timeout 300 --log .ai-work/corpus-v2/image.log -- docker build -t cratis-corpus-v2:fixture Evaluations/corpus-v2

yarn workspace @cratis/ai-skill-evaluation run evaluate suite --harness pi --arms v1,v2,none --runs 3 --seed 1349 --dry-run
yarn workspace @cratis/ai-skill-evaluation run evaluate suite --harness pi --pilot --dry-run

# One authorized subscription-provider smoke (tokens/time, not per-token USD billing):
yarn workspace @cratis/ai-skill-evaluation run evaluate suite --harness pi --arms none --task 01-concepts --runs 1 --concurrency 1 --run .ai-work/corpus-v2/runs/smoke

# Resume: repeat the identical command and run directory. Final rows (including failures) are not retried.
yarn workspace @cratis/ai-skill-evaluation run evaluate suite-report .ai-work/corpus-v2/runs/smoke
```

The runner preflights selected fixture variants before any model call. Builds use `--timeout 300`; executable specs use `--timeout 600`; every phase uses `--queue-timeout 3600`. Do not cancel a phase merely because it waits. Failed preflight, changed locked inputs, model substitution, missing auth or image stops new trajectories. Failed/aborted agents stop further scheduling while already-running workers finish and persist telemetry. Interrupted attempts are preserved, never overwritten. Locks are never silently cleared. Raw logs, normalized events, fixture modifications, metrics and reports stay under ignored `.ai-work/corpus-v2/runs/<run>/`.

## Scoring and interpretation

Each task requires named executable agent-authored specs, a real package-backed build, executable baseline/new specs, and critical structured source-idiom checks. Each declared idiom has a positive witness and negative mutant exercised by harness unit specs. This catches missing implementation and common incorrect framework patterns; **structured grep is not an AST or behavioral proof**. Hidden behavioral contracts currently cover concepts, basic commands, validation, checkout-state rejection, authorization and loyalty concepts. Remaining tasks rely on agent-authored executable specs plus idioms; their behavioral coverage is not equivalent to an independent hidden integration oracle. Do not publish a superiority claim from this coverage alone. React checks exercise native Node testable state/interaction logic, not a browser render/accessibility oracle. Screenplay compiles and executes model specifications; grep checks additionally inspect links.

The report keeps failed/time-out trials in denominators, labels infrastructure separately, summarizes per arm/area and supplies paired task-cluster bootstrap intervals. Missing input/output/cache/reasoning usage is null, not zero. Subscription USD is unavailable, not a token-price estimate. Baseline routing is N/A; an unavailable taxonomy mapping is also N/A rather than an invented failure. Counts distinguish attempted skill reads from successful reads. Pilot/smoke outcomes and partial matrices are inconclusive. Efficiency claims require noninferior quality, not merely fewer tokens spent giving up.

No paid/full matrix has been run or claimed by adding these files. Review the task contracts, hidden coverage and dependency-image preflight before approving the 18-call pilot or 216-call batch.
