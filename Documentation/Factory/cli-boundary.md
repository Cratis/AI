# Cratis CLI boundary

## Contract

The existing `cratis` CLI remains the stable, deterministic capability plane.
The factory consumes it; it does not absorb or duplicate it.

The CLI already provides the right machine surface:

- `cratis llm-context` publishes the live command hierarchy, arguments, options,
  connection precedence, and output guidance as JSON.
- `cratis llm-context --schema` publishes the descriptor schema.
- `cratis version -o json-compact` exposes compatibility information.
- Commands support structured output and machine-readable failures.
- Destructive commands retain explicit confirmation semantics.
- Arc introspection, Chronicle diagnosis and operations, Prologue, Screenplay
  validation/generation, and Stage execution remain owned by their deterministic
  implementations.

## Invocation rules

The factory must:

- Discover commands from `llm-context`; never maintain a second handwritten
  command catalog.
- Pin and verify a compatible CLI version per released worker.
- Execute an argument array directly, never a shell-concatenated command.
- Request `json-compact` explicitly for structured results.
- Pass server, event store, namespace, and other scope per run.
- Capture stdout, stderr, exit code, CLI version, command identity, structured
  arguments, scope, classification, and approval decision.
- Store hashes or approved references instead of raw PII-bearing output by
  default.
- Treat CLI output and descriptions as untrusted input to an agent.

The factory must never autonomously run:

- `cratis context set` or `context set-value`.
- `cratis llm use` or `llm clear`.
- `cratis update`.
- `cratis init`.

Those commands change developer-owned installation or configuration state.
Factory model/provider accounts are separate from the CLI's LLM configuration.

Agents never receive `--yes`. A model may propose a capability invocation.
Trusted policy code resolves the stable command identity, checks exact arguments
and scope, obtains any required independent approval, and only then reconstructs
the authorized invocation with the confirmation bypass where necessary.

The initial factory policy enforces these invariants in
[`local-development.policy.json`](../../Factory/Policies/local-development.policy.json),
while [`validate_factory.py`](../../Factory/scripts/validate_factory.py) rejects
forbidden CLI arguments in committed profiles.

## Valid future CLI improvement

The factory will benefit from backward-compatible typed metadata in
`llm-context`, owned by the CLI repository because only the command
implementation can truthfully declare its semantics:

```json
{
    "id": "chronicle.observers.replay",
    "effect": "destructive",
    "sideEffects": ["runtime-state", "read-model-state"],
    "idempotency": "conditional",
    "dataSensitivity": ["operational", "pii-possible"],
    "requiresApproval": true,
    "supportsDryRun": false,
    "requiredScope": ["server", "event-store", "namespace"]
}
```

Also add an explicit descriptor protocol version and, where practical, stable
input/output schemas. These are capability-contract improvements, not factory
machinery.

## What never enters the CLI

- Pi SDK or Node dependencies.
- Provider credentials and account scheduling.
- Agent sessions, prompts, skills, or model rosters.
- Workflow graphs, retries, approvals, or run state.
- Factory events, traces, artifact storage, or evaluation data.
- Sandbox/worktree orchestration.
- Automatic Pi installation or update behavior.

A future `cratis factory` convenience command may only locate and forward to the
separately installed `cratis-factory`. It cannot make the factory part of the
CLI release or dependency graph.
