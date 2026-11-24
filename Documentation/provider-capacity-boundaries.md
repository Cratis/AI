# Provider allowance at session-usage boundaries

`Cratis.AI.Usage.Recording.RecordAgentSessionUsageWithCapacity` is the additive usage path used by managed language-model completions (including image completions) and pooled chat responses (including streaming). At each **existing usage-recording point**, it prepares one cache-only observation and appends, in order, on the session stream:

1. The unchanged `AgentSessionUsageRecorded`, with exactly the same token, cost, CPU, memory, duration and calendar-bucket semantics as the legacy command.
2. `AgentSessionCapacityObserved`, correlating the session, agent and purpose with the explicit `UsageRecorded` boundary kind and a nested `AIProviderCapacitySnapshot`.

The additive command and its companion/preparation types live in the separate `Usage/Recording` slice. This keeps the legacy command's `/api/a-i/usage` route unchanged. The generated `Usage/Recording` folder is exported at the package root alongside the existing usage exports.

Preparation constructs the legacy command and its usage event once. The prepared usage event and one captured snapshot are reused by the single ordered append; `Handle` does not recalculate usage or capture again.

This is an additive **MINOR** change; existing public members and generated exports remain usable. See the [#375 amendment to decision 0002](./decisions/0002-event-evolution-no-migrations.md). The legacy command, event identity and schema remain supported. Old streams need no migration, upcast, synthetic snapshot or backfill. Existing daily/weekly/monthly usage projections consume only the legacy usage event; the companion must not be counted as usage. Both commands retain the management authorization policy. Runtime constructor signatures and their handling of missing usage/session/provider context are unchanged.

## Cache-only capture

`IAIProviderCapacitySnapshots.Capture(actualProvider)` is reusable at other boundaries. It reads the existing `IAIProviderCapacityObservations` singleton's optional in-memory view. It does **not** query configuration/read models, call a reporter/vendor, start or await a refresh, calculate usage, or decide whether work may start. Convention discovery finds the capture service; no second observation-cache DI alias is required. Custom observation implementations without the optional capability return unavailable. A cold cache remains cold.

Ordinary `AIProviderCapacities.For()` calls publish the selected vendor or fallback observation into that view. Configured ceilings and explicit unmetered fallbacks remain distinct from vendor subscriptions and unknown capacity. Fallback publication never replaces the vendor cache/backoff entry. Credential fingerprints, selected-observation versions and the account identity of shared reads prevent a late old-account result from replacing newer boundary facts, including a no-reporter fallback. An unknown/removed provider clears its boundary observation. `Forget()` retains the last observation as stale, without changing its observation time or the normal query's refresh behavior.

## Meaning of the snapshot

- `Provider` is the **actual** selected provider, not an agent's configured preference. `AIProviderId.NotSet` represents unresolved identity.
- `CapturedAt` is the boundary time; `ObservedAt` is the original allowance observation/calculation time. `DateTimeOffset.MinValue` (`UnknownTime`) explicitly means no observation time, or an unknown window reset; persisted snapshot values are non-null.
- `Source` distinguishes subscription, configured ceiling, unmetered and unknown. `State` is `Available`, `Stale` or `Unavailable`. **Available does not mean permitted**: known zero remaining is available information.
- Every raw window is copied independently, in order, with its kind, label, clamped remaining fraction and reported reset. Five-hour, weekly, model-specific weekly and other windows are not collapsed into one headroom number. The event's window list cannot change when a reporter mutates its source list.
- A failed refresh retains last-good windows/time as stale. `Forget()`, TTL expiry (at the exact freshness limit), and passed resets also mark stale. A passed reset never manufactures fresh allowance, even though the ordinary capacity query can continue applying its existing scheduling policy.
- Unavailable has no invented full allowance, observation time or windows. Explicit unmetered capacity can be available with no windows. Empty alone must never be interpreted as full allowance.
- Reasons are fixed enum values. Credentials, hashes, vendor problems, exception text and HTTP details are not event fields. Capture failure produces an unavailable companion and cannot suppress ordinary usage recording.

## Consumers and historical decisions

These are **provider-wide observations at a boundary**, not the consumption of that task. A later consumer can retain a chosen boundary as a historical budget baseline, but must account separately for concurrent provider activity and the age/source of the observation. Do not subtract two snapshots to claim task cost, sum windows/snapshots into usage totals, or treat capture as a current live query. The same cached observation may appear at both start and stop; shared usage and window resets make their difference unsuitable as exact task consumption.

Consumers wanting historical allowance subscribe to `AgentSessionCapacityObserved` in their own projection, separately from consumption events. At a consumer-owned start or terminal boundary, call `Capture` with the actual selected provider once and reuse that snapshot across that boundary's events. Do not infer completed/failed/cancelled outcomes from `UsageRecorded`. A cold cache can honestly yield unavailable at either boundary. Workflow checkpoints, start/resume orchestration, autonomy policy, UI and new projections are deliberately outside this package change. **Direct remains paused: no Direct implementation or coverage is claimed.**

## Event and producer inventory

The package owns terminal **usage-writing points**, not a generic work lifecycle. Names such as authentication "session" and provider usage "snapshot" do not make those events task boundaries.

| Event or producer | Classification and treatment |
| --- | --- |
| `Usage/AgentSessionUsageRecorded` / `RecordAgentSessionUsage` | Sole active generic consumption event and retained legacy write path. Existing contracts, event identity, session stream and aggregates are unchanged. The additive command emits this event followed by one allowance companion. |
| `LanguageModels/ManagedLanguageModel` | Completion and image-completion usage writer when reported usage/session context exists. Uses the actual result provider. No new start event or unconditional failure/cancellation write. |
| `Conversations/PooledChatClient` | Chat and completed streaming-turn usage writer using the actual dispatch provider. Existing early-disposal/error paths may skip the post-loop usage write; that behavior remains unchanged. |
| `Decisions/Usage/DecisionUsageRecorded` / `RecordDecisionUsage` | Obsolete retained contract; #651 says it is no longer appended. Engine identity is not configured provider identity. Not revived or changed. |
| `Providers/RateLimiting/AIProviderRateLimited` / `ProviderRateLimitRecorder` | Provider-level failed-attempt quota state, potentially followed by retry, without session identity. Not task start/stop or consumption; unchanged, with no extra capture or query. |
| `Providers/RateLimiting/AIProviderRateLimitCleared` | Administrative provider-state change, not a work boundary; unchanged. |
| `Providers/UsageReporting/RecordingSnapshot/AIProviderUsageSnapshotRecorded` / `RecordAIProviderUsageSnapshot` | Obsolete/no longer appended under #651. Historical provider-refresh/selection audit, not work lifecycle or remaining allowance. Not revived. |
| Other events for agents, provider adding/configuring/sign-in, Codex/Copilot discovery, pools and decision configuration | Configuration, credential, authentication-session and discovery facts. Not AI task/session start/stop; excluded. |
| `Workers/IWorkerRuntime`, `DockerWorkerRuntime`, `KubernetesWorkerRuntime` | Runtime launch/stop outcomes and log state, not AI-owned task/session domain appenders. No lifecycle event is invented and no worker implementation changes. |
| Direct and other consumers' task/workflow boundaries | Consumer-owned. Their orchestration, projections and lifecycle events are outside this package change; Direct remains paused. |
