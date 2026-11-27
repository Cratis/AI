# Agent configuration: role and assignment events

An agent's **role** (purpose, name, description, tier, harness preference, effort) and its
**assignment** (a provider, a provider pool, or neither) are separate facts. New writes record them
as separate events on the agent's stream, so each can change without restating the other.

## Writing: `DefineAgent`

`Cratis.AI.Agents.Defining.DefineAgent` takes the same inputs as `ConfigureAgent`, applies the same
validation (purpose and name required, provider and pool not both, authorization policy, provider
and pool capability checks), and appends, in order:

1. `AgentRoleConfigured` - purpose, name, description, tier, harness, effort.
2. Exactly one of:
   - `AgentAssignedToProvider` - when a real provider is given.
   - `AgentAssignedToPool` - when a real pool is given.
   - `AgentAssignmentCleared` - when neither is given (absent or `NotSet`).

Each assignment event replaces whatever assignment came before it; the read model never keeps a
stale provider after a pool, or the reverse. A "cleared" agent has no explicit assignment. This
change records the stored assignment only - routing and refusal policy for an agent with no
assignment is unchanged.

`SeedAgent` now records `AgentRoleConfigured` then `AgentAssignedToProvider`, and still records
nothing when the purpose already has an agent. Its passive presence reads both the legacy and the
new role events, so a cleared agent is not reseeded.

## Legacy: `ConfigureAgent` and `AgentConfigured`

`ConfigureAgent` is the **legacy write path**. It is unchanged (signature, route, generated proxy)
and still appends the combined `AgentConfigured` event, kept for compatibility and to be removed in
a later major release. New callers use `DefineAgent`.

`AgentConfigured` stays a registered event type with an unchanged contract. Stored events replay
exactly as before - provider, pool or neither (a legacy event with neither clears an earlier
assignment). The `Agent` read model reads both forms, in any mixture, in stream order. No repair,
backfill or rewrite of stored events is needed, and consumers need no maintenance window.

## Consumers

Consumers with their own projections or reactors must subscribe to `AgentRoleConfigured`,
`AgentAssignedToProvider`, `AgentAssignedToPool` and `AgentAssignmentCleared` in addition to
`AgentConfigured` to see agents written through `DefineAgent`. `AgentIdentityNaming` handles both role
events and ignores assignment events. If a projection must be rebuilt, use the normal consumer
rebuild process.

This is an additive (minor) change: all existing public members and generated exports remain. See the
[amendment to decision 0002](./decisions/0002-event-evolution-no-migrations.md) for how it relates to
the event evolution policy.

## Allowance at usage boundaries

The provider or pool assigned to an agent is not necessarily the provider used by a particular
completion. Package-owned usage writers record the actual resolved provider's cache-only allowance
alongside usage, without changing assignments or routing. See
[provider allowance at session-usage boundaries](./provider-capacity-boundaries.md) for the additive
command/event, historical-consumer guidance and the separate #375 amendment to decision 0002.
