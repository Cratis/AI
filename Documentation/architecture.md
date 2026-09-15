# Architecture

`Cratis.AI` is a single packable project (`Source/Cratis.AI/`), organized into vertical-slice
folders in the house style both donor repositories (Direct, Studio) already follow. Specs live
inline (`for_*/when_*/given/`) in a sibling `Cratis.AI.Specs` project, kept out of the published
package (`IsPackable=false`).

## Layers, in dependency order

```text
Abstractions/    the seams a consumer implements - never references Direct.* or Studio.*
Common/          cross-cutting concepts and helpers (WeekKey, MonthKey, ModelName, command-pipeline helpers)
Agents/          agent identity, causation, and the IAgentExecution scope
LanguageModels/  the single-shot completion contract (ILanguageModel, LanguageModelResult, ManagedLanguageModel)
Providers/       provider vocabulary and (once ported) vendor clients, pools, tiers, resolution
Usage/           the usage subsystem: concepts, the event, the command, the read models
Workers/         worker/harness scheduling contract (IWorkerRuntime) and (once ported) implementations
Conversations/   the conversational/tool-calling API (ported from Studio's ChatClient) - not yet started
Configuration/   AddCratisAI() and the builder consumers configure seams through
```

Each layer only depends on the ones above it in this list. `Abstractions/` has no dependency on
anything else in the package; `Conversations/` (once it exists) will depend on `Providers/` for
resolution the same way `LanguageModels/` already does.

## Why Abstractions comes first

Plan Section 5.1: "Create `Source/Cratis.AI/Abstractions/` first - nothing else can move cleanly
until these exist." The package never references a consumer's domain types (`Direct.Agents`,
`Studio.Settings.AI`, ...) - every place the original donor code reached into Direct's or Studio's
own domain is instead a seam:

| Seam | Answers | Consumer supplies |
|---|---|---|
| `ISecretProtector` / `ISecretRevealer` | How is a credential protected at rest? | A wrapper over the consumer's own vault (Direct: `Tenants.Encryption`; Studio: `Organizations.Encryption`) |
| `IAIAgents` | Who is this agent? | A lookup over the consumer's own agent catalog |
| `IAIAlerts` | Who gets told when something operational goes wrong? | The consumer's alerting system, or the shipped no-op default |
| `IAIUsageAttribution` | What does this session's usage belong to, in the consumer's own domain? | The consumer's own resolution (Direct: issues a session covered) |

See [`abstractions.md`](./abstractions.md) for the full contract and how a consumer wires them up.

## Identity and causation

Every event an agent-driven code path causes must be attributed to the agent, not to an
undifferentiated system identity - and the causation chain leading to it should say *why* the agent
was acting (which purpose, which session), not only *who*. Chronicle already ships two separate
mechanisms for this (`Cratis.Chronicle.Identities.IIdentityProvider` and
`Cratis.Chronicle.Auditing.ICausationManager`); `Agents/IAgentExecution` is the one call that opens
both together, so a call site cannot establish one and forget the other. See decision
[`0001-agent-identity-and-causation.md`](./decisions/0001-agent-identity-and-causation.md) for the
full reasoning, including why authorization is deliberately left out of the package's own
`IAgentExecution` and stays a consumer concern.

## Usage

Every operation the package performs - a single completion, a conversation turn, a harness-run
worker session - is meant to return a result carrying its usage (tokens, cost, duration, and for
harness sessions, CPU and memory), and to append one `AgentSessionUsageRecorded` event through the
Chronicle client. See [`usage.md`](./usage.md).

## Type discovery: why the assembly must be named `Cratis.AI`

Chronicle's `DefaultClientArtifactsProvider` discovers package-referenced assemblies by reflecting
over ones whose name starts with `Cratis`. `Cratis.AI.csproj` pins `AssemblyName` explicitly for
this reason - renaming it silently breaks event-type/read-model/reactor discovery for every consumer.
Arc's own generated type-discovery path has a second, independent ordering hazard: `AddCratisAI()`
must be called before `AddCratisArc()`/`AddChronicle()`, or a lazily-loaded `Cratis.AI.dll`
contributes nothing to the type universe Arc snapshots. `AddCratisAI()` self-checks this at startup
and throws a `CratisAIOrderingViolation` naming the fix rather than failing silently - see
[`abstractions.md`](./abstractions.md#registration-and-the-ordering-rule).
