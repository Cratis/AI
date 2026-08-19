# Definition/workflow compilation Stage 0 differential

This deletion-bound observer executes the historical native-result lane and the
narrow Stage 0 Python lane from the immutable v1 design corpus. It is
maintainer-only migration evidence, not a product specification or acceptance
gate. Permanent native framework-style specifications own compiler semantics.

Run one configuration at a time:

```shell
dotnet run --project Factory/Migration/DefinitionWorkflowCompilationParity/Cratis.Factory.DefinitionWorkflowCompilationParity.csproj -c Debug
dotnet run --project Factory/Migration/DefinitionWorkflowCompilationParity/Cratis.Factory.DefinitionWorkflowCompilationParity.csproj -c Release
Factory/Migration/DefinitionWorkflowCompilationParity/run-performance.sh
```

The observer reports `HISTORICAL_MATCH` or `HISTORICAL_DRIFT`. Semantic drift is
mechanically non-blocking and is never rewritten, hidden, or special-cased to
manufacture historical parity. With the contract-correct per-reference
capability diagnostic, the immutable corpus currently reports two expected-
result field mismatches. Infrastructure failure or an invalid Stage 0
observation still fails the observer itself, but the command is excluded from
product acceptance. The adapter verifies the three frozen oracle hashes,
invokes Python with `-I -B`, materializes only explicit caller bytes in a fresh
temporary directory, never interprets Stage 0 prose, and compares only verdict
and ordered phase IDs. Keep this directory until the accepted deletion
condition is durable.

The blocking performance command does not load the definition corpus. It builds
its committed and structural inputs from explicit migration-only definitions
and frozen numeric limits. It measures the cold 26-definition call exactly once
in an isolated self-contained, fully trimmed `net10.0`/`osx-arm64` NativeAOT
process.
It enforces the call's elapsed time and thread allocation in the consumer and
obtains its process maximum RSS from macOS `/usr/bin/time`; a missing or zero RSS
signal fails closed. The command then reports every warm and structural
time/allocation ceiling without folding structural failures into an average and
conservatively applies the externally measured suite RSS to every exact
structural-maximum call. The NativeAOT process runs from embedded caller bytes
in a fresh sandbox that denies repository reads, network access, and file
writes. Windows and Linux execution remain pending.
