# Usage

The brief behind this consolidation is explicit: every operation the package performs should
return a result carrying its usage, and every agent session's usage should be recorded through
Chronicle so it can be reported on, trended, and attributed. `Source/Cratis.AI/Usage/` is that
subsystem.

## Concepts

Formalized with validators, per the brief's explicit call-out:

| Concept | Carries | Validator rejects |
|---|---|---|
| `CpuSeconds` | CPU time a harness measured | negative, or above an implausible ceiling (1,000,000s) |
| `MemoryBytes` | Peak memory a harness measured | negative, or above 1 TiB |
| `InputTokens` / `OutputTokens` / `CachedTokens` | Token counts | negative |
| `CostUsd` | Reported cost in USD | negative, or above $100,000 |
| `DurationMilliseconds` | How long a session took | negative |

The magnitude ceilings on `CpuSeconds`/`MemoryBytes`/`CostUsd` exist because Direct hit exactly this
bug once in production (Cratis/Stagehand#747) - an unvalidated, garbage or overflowed measurement
silently skewed every resource-usage figure derived from it. Every consumer of the package inherits
this protection for free.

## The event

```csharp
[EventType(AgentSessionUsageRecorded.EventTypeId)]
public record AgentSessionUsageRecorded(
    AgentSessionId Session, AgentId Agent, AIProviderId? Provider, ModelName Model,
    Harness? Harness, LanguageModelPurpose Purpose,
    InputTokens InputTokens, OutputTokens OutputTokens, CachedTokens CachedTokens,
    CostUsd CostUsd, CpuSeconds CpuSeconds, MemoryBytes MemoryBytes, DurationMilliseconds Duration,
    WeekKey WeekKey, MonthKey MonthKey);
```

One event type for every kind of agent session - a single completion, a conversation turn, or a
harness-run worker session - generalizing what used to be three separate, overlapping event types
across the two donor repositories (Direct's `IssueAgentSessionUsageRecorded` and
`LanguageModelUsageRecorded`; Studio's `LlmTokensConsumed`). Notable design choices, carried over
from the donor code's own reasoning:

- **No organization/tenant property.** Chronicle tenant isolation answers "whose" by where the
  event landed.
- **`WeekKey`/`MonthKey` are precomputed at command time**, not derived from `EventContext.Occurred`
  at projection time - Chronicle's model-bound key resolution only accepts event properties.
- **Cross-stream fan-out is a consumer concern**, resolved through `IAIUsageAttribution` - the event
  only ever appends on the session's own stream.
- **The `EventTypeId` is pinned explicitly and must never change** without going through the
  procedure in [`decisions/0002-event-evolution-no-migrations.md`](./decisions/0002-event-evolution-no-migrations.md).

## The command

`RecordAgentSessionUsage` accepts the full harness callback payload shape (`status, detail,
inputTokens, outputTokens, costUsd, durationMs, cpuSeconds, memoryBytes`) plus the resolution
context a direct completion already has to hand, and appends `AgentSessionUsageRecorded` on the
session's own stream. Every property beyond the required identity/model/purpose is optional, so its
validator rejects negative figures at the command boundary rather than relying on each concept's
own validator - which only runs once the concept is actually constructed, and an unreported figure
never is.

`ManagedLanguageModel` (`LanguageModels/`) is the first real caller: every completion, successful or
not, that reported usage gets it recorded through this command, with a fresh `AgentSessionId` per
completion - a direct completion is just a session that never reports CPU or memory.

## Read models

- **`Usage/Trends/AgentUsageByWeek`, `AgentUsageByMonth`** - accumulating projections off
  `AgentSessionUsageRecorded`, one document per calendar week/month across every session, keyed on
  the event's own precomputed `WeekKey`/`MonthKey`.
- **`Usage/Daily/AgentUsageByDay`** - an on-demand (`[Passive]`) aggregation bucketed by
  provider/agent/purpose/model, the shape a usage page's filters narrow without a second round trip
  per filter. Reads from one source (`IRecordedAgentSessions`) rather than Direct's original two
  (`IRecordedWork` + `ILanguageModelJobs`) - simpler because the event consolidation makes it
  simpler, not because anything was dropped.

## Event evolution: no migrations

Both donor repositories have a standing policy, independent of this consolidation: no event-type
migrations, no generations (`[EventType(generation: N)]`, `EventTypeMigration<T, TPrevious>`) -
evolve an event type in place and repair production at rollout with a documented scale-down +
MongoDB registry/collection surgery procedure. `AgentSessionUsageRecorded` is the one event type
from day one; the donor event types it replaces are retired via that same procedure at each
product's actual cutover PR, not kept alive indefinitely as parallel types. Full detail, including
why the surgery is not run before a product actually ships against the new schema:
[`decisions/0002-event-evolution-no-migrations.md`](./decisions/0002-event-evolution-no-migrations.md).
