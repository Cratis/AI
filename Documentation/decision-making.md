# Decision Making

A decision is not a completion. The caller supplies a context and a finite set of outcomes; the
engine weighs them and returns a probability distribution. Nothing is generated.

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

`DecisionResult` carries the engine's **raw** distribution plus two derived values:

| Member | Why it is here |
|---|---|
| `Outcomes` | Every supplied choice with its probability, ordered descending. Never clamped, rounded or filtered — thresholding is consumer policy, and a package that pre-applied one would make calibration impossible to measure after the fact. |
| `Top` / `TopProbability` | The winner, as a convenience. |
| `Margin` | Distance to the runner-up. Precomputed because every consumer needs it, and four consumers each deriving it is how four subtly different definitions of the same word appear. |
| `Model` / `Engine` / `Latency` | Telemetry. Nothing branches on them. |

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

Rejected before reaching an engine, because an engine would answer them anyway and the caller
would have no way to tell the answer was meaningless:

- an empty context
- no choices
- duplicate choices — they collapse on the way back, leaving a distribution that no longer sums to
  what the engine computed
- more choices than `DecisionOptions.MaxChoices`

A response that omits a supplied choice raises `DecisionChoicesNotCovered` rather than being
completed with zeros: "the engine considered this impossible" and "the engine never looked at
it" want opposite responses from a caller.

## Engines

There is only ever **one** decision engine in force - a deployment chooses between engines rather
than adding providers to a list, which is the difference from language-model providers.

| `DecisionEngineType` | What it is | What it needs |
|---|---|---|
| `BuiltIn` | The Cratis Decision Engine in `Source/DecisionEngine/`, deployed to the shared cluster by `Cratis/Infrastructure` | Nothing a person enters - its address is deployment configuration |
| `Jev` | TypeSafe AI's Jev, a hosted System One model | An API key; optionally a model (default `jev-latest`) and an endpoint (default `https://api.typesafe.ai`) |

Each engine has an `IDecisionEngineClient`, discovered by convention the same way a language-model
vendor has its provider client. `DecisionEngineType` is persisted in events - append, never renumber.

### Choosing an engine

Two commands, both recorded under the single `DecisionEngineId.Default` stream:

| Command | Event | Notes |
|---|---|---|
| `UseBuiltInDecisionEngine` | `BuiltInDecisionEngineSelected` | Refused when the deployment has no built-in engine |
| `UseJevDecisionEngine(ApiKey, Model, Endpoint)` | `JevDecisionEngineSelected` | A blank key keeps the one already recorded; blank model and endpoint take the defaults |

The API key is `[Encrypted]` at rest and `[NotAudited]`, like a provider's API key. Choosing the
built-in engine keeps the Jev settings, so switching back does not ask for the key again.

`CurrentDecisionEngine` returns `DecisionEngineSettings` for a settings page: which engine is in
force, what each is configured with, whether a Jev key is recorded (never the key itself), and the
result of the engine's last health check.

Until anything is chosen, decisions go to the built-in engine. That fallback is what makes a host
work out of the box.

### The built-in engine's address

Bound from `Cratis:AI:Decisions:BuiltIn`:

| Setting | Notes |
|---|---|
| `Endpoint` | The engine's internal cluster address. Unset means the deployment has no built-in engine |
| `Model` | The model it is deployed with, for display and usage reporting |

### Questions and descriptions

`DecisionRequest` optionally carries a `Question`, a description per choice, and a `Topic`. The
choices stay the opaque identifiers the caller branches on; the question and descriptions tell the
engine what those identifiers mean. Jev takes them natively as a `choice` question's instructions and
criteria. The built-in engine puts them into its multiple-choice prompt.

Requests in a batch that share a context go to Jev as several questions against one state, in one
call - Jev evaluates them in parallel and bills for the state once.

## Usage

Every call that produced an answer appends `DecisionUsageRecorded` through `RecordDecisionUsage`:
engine, model, topic, how many decisions and choices, the tokens the engine reported (Jev reports
them; the built-in engine does not) and how long it took. `DecisionUsageByDay` accumulates them per
day, engine, model and topic; `DecisionUsageForLastThirtyDays` reads the trailing month.

A failed usage record is logged, never allowed to fail a decision that was already made.

## Registration

```csharp
builder.Services.AddCratisAI(ai => ai
    .WithAgents<OrganizationAgents>()
    .WithDecisions());
```

`WithDecisions()` resolves the engine from the configuration above through
`ConfiguredDecisionEngineResolver`. A host that needs to decide for itself registers its own
`IDecisionEngineResolver` with `WithDecisions<TResolver>()`.

Nothing decision-related is registered when `WithDecisions` is not called.

### Options

Bound from `Cratis:AI:Decisions`. Transport and telemetry only.

| Setting | Default | Notes |
|---|---|---|
| `Timeout` | 5s | Short on purpose: a decision that takes longer than a few seconds has already lost its reason to exist, and the caller is better served falling back |
| `MaxChoices` | 32 | |
| `MaxBatchSize` | 32 | |
| `RecordContextInTelemetry` | `false` | Context carries whatever the calling workflow put in it. Off unless deliberately enabled |
| `HealthCheckInterval` | 30s | How long a health check of the engine is reused before it is made again |

## Telemetry

`ActivitySource` and `Meter` named `Cratis.AI.Decisions`.

- `cratis.ai.decision.duration` (ms histogram)
- `cratis.ai.decision.count`
- `cratis.ai.decision.top_probability` — **the calibration signal**. An engine answering every
  question at 0.34/0.33/0.33 is useless in a way no latency graph will ever show.

Tags: `decision.engine`, `model`, `outcome`. The context text is not recorded unless
`RecordContextInTelemetry` is on.
