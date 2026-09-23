# Decision Making

A decision is not a completion. The caller supplies a context and a finite set of outcomes; the
provider weighs them and returns a probability distribution. Nothing is generated.

It exists so that bounded workflow decisions — which agent, which model tier, which next action,
which diagnostic path — stop costing a frontier-model call each.

```text
Context: Issue #123: NRE during projection replay

Choices:
- investigate
- plan
- implement
- ask_user

Result:
investigate  0.05
plan         0.12
implement    0.82
ask_user     0.01
```

## The surface

`IDecisions` in `Cratis.AI.Decisions` is what consumers call.

```csharp
Task<DecisionResult> Decide(DecisionRequest request, CancellationToken cancellationToken = default);
Task<IReadOnlyList<DecisionResult>> Decide(IReadOnlyList<DecisionRequest> requests, CancellationToken cancellationToken = default);
```

`DecisionResult` carries the provider's **raw** distribution plus two derived values:

| Member | Why it is here |
|---|---|
| `Outcomes` | Every supplied choice with its probability, ordered descending. Never clamped, rounded or filtered — thresholding is consumer policy, and a package that pre-applied one would make calibration impossible to measure after the fact. |
| `Top` / `TopProbability` | The winner, as a convenience. |
| `Margin` | Distance to the runner-up. Precomputed because every consumer needs it, and four consumers each deriving it is how four subtly different definitions of the same word appear. |
| `Model` / `Provider` / `Latency` | Telemetry. Nothing branches on them. |

### What this surface deliberately does not do

**No thresholds, no fallback, no retry policy.** What counts as confident enough — and what to do
when it is not — differs per workflow. Baking a threshold in here would force every consumer to a
single answer and, worse, would destroy the raw distribution the calibration work depends on.

### The batch overload

Exists for callers scoring many candidates against one task — relevance filtering scores tens of
items per agent invocation, and paying a round trip each would cost more than the filtering saves.
Results are guaranteed to come back in request order so callers can zip them onto their candidates
positionally.

## Ties are deterministic

A tie resolves to whichever choice the caller **listed first**. `Decisions` rebuilds the outcome
list in the caller's supplied order before the stable sort, so the workflow's own ordering — the
only ordering that means anything here — breaks the tie. Without this an idempotent workflow stops
being idempotent the moment two options score equally.

## Requests that are refused

Rejected before reaching a provider, because a provider would answer them anyway and the caller
would have no way to tell the answer was meaningless:

- an empty context
- no choices
- duplicate choices — they collapse on the way back, leaving a distribution that no longer sums to
  what the provider computed
- more choices than `DecisionOptions.MaxChoices`

A response that omits a supplied choice raises `DecisionChoicesNotCovered` rather than being
completed with zeros: "the provider considered this impossible" and "the provider never looked at
it" want opposite responses from a caller.

## Capabilities

Three enums gained a member. **All three are persisted in events — append, never renumber.**

| Enum | Member |
|---|---|
| `AIProviderCapability` | `Decision = 2` |
| `AIModelCapability` | `Decision = 4` |
| `AIProviderType` | `DecisionEngine = 6` |

`AIProviderCapabilities.For(AIProviderType.DecisionEngine)` returns `{ Decision }` and deliberately
**not** `Conversational` or `Agentic`. Declaring the capabilities it lacks is what stops an agent
being scheduled onto a decision engine — the compatibility checks that already exist read this, so
the refusal needs no new code anywhere else.

`AIModelCapabilities` gained a `For(AIProviderType, ModelName)` overload. The existing substring
heuristic cannot see a decision model: a small open model's identifier carries no marker that
distinguishes it from a chat model, and the existing markers would happily label it conversational.
On a decision engine the capability is declared by provider type instead — which is also the only
honest answer, since what the model can do there is decided by the service in front of it rather
than by the weights.

## Registration

```csharp
builder.Services.AddCratisAI(ai => ai
    .WithSecretProtection<OrganizationSecretProtector>()
    .WithAgents<OrganizationAgents>()
    .WithDecisions<OrganizationDecisionProvider>());
```

`IDecisionProviderResolver` is **required**, not defaulted. Which provider serves decisions is a
product setting — a built-in platform engine for one host, a user-configured provider for another —
and a package that guessed one would be making a configuration decision on behalf of a host that
never asked it to.

Nothing decision-related is registered when `WithDecisions` is not called.

### Options

Bound from `Cratis:AI:Decisions`. Transport and telemetry only.

| Setting | Default | Notes |
|---|---|---|
| `Timeout` | 5s | Short on purpose: a decision that takes longer than a few seconds has already lost its reason to exist, and the caller is better served falling back |
| `MaxChoices` | 32 | |
| `MaxBatchSize` | 32 | |
| `RecordContextInTelemetry` | `false` | Context carries whatever the calling workflow put in it. Off unless deliberately enabled |

## Telemetry

`ActivitySource` and `Meter` named `Cratis.AI.Decisions`.

- `cratis.ai.decision.duration` (ms histogram)
- `cratis.ai.decision.count`
- `cratis.ai.decision.top_probability` — **the calibration signal**. A provider answering every
  question at 0.34/0.33/0.33 is useless in a way no latency graph will ever show.

Tags: `provider.type`, `model`, `outcome`. The context text is not recorded unless
`RecordContextInTelemetry` is on.

## The Decision Engine provider

`DecisionEngineProviderClient` speaks Decision API v1 to a Cratis Decision Engine —
`Source/DecisionEngine/` in this repository, deployed to the shared cluster by
`Cratis/Infrastructure`.

Configure additional engines with `AddDecisionEngineProvider` / `ReconfigureDecisionEngineProvider`.
The model is pinned on the provider rather than supplied per call, the same way Studio's provider
shape pins one: an engine hosts exactly one loaded model, and a caller naming a different one would
be asking for something the service cannot serve.
