# Abstractions

`Cratis.AI` never references a consumer's own domain types. Everywhere the original donor code
(Direct, Studio) reached into its own product - a tenant's encryption vault, its own agent catalog,
its own alerting - the package instead defines a seam, and the consumer supplies the implementation.
This is what lets Direct and Studio share one package without either leaking into it.

## The seams

### `ISecretProtector` / `ISecretRevealer`

```csharp
public interface ISecretProtector { Task<string> Protect(string value); }
public interface ISecretRevealer  { Task<string> Reveal(string value); }
```

Protects/reveals a secret (a provider API key, a subscription token) at rest. The package never
sees a key vault and never logs a credential - it calls `Protect` at the point a secret is about to
be persisted, and `Reveal` at the point one is about to be used. No safe default exists; a consumer
must register one. Direct implements it over `Tenants.Encryption`; Studio over
`Organizations.Encryption`.

### `IAIAgents`

```csharp
public interface IAIAgents
{
    AgentDescriptor? Find(AgentId id);
    AgentDescriptor? FindByPurpose(LanguageModelPurpose purpose);
}
```

Looks up the identity of an agent without the package owning the full agent model (that
reconciliation is plan Section 5.5, not yet done). `IAgentExecution` resolves an agent through this.
No safe default; required for `IAgentExecution.As(...)` to ever attribute anything.

### `IAIAlerts`

```csharp
public interface IAIAlerts { Task Raise(AIAlert alert); }
```

Operational signalling for conditions the package cannot resolve on its own - a provider
exhausting its concurrency gate, a subscription token failing to refresh. Defaults to
`NoOpAIAlerts` when a consumer has not wired an alerting system yet.

### `IAIUsageAttribution`

```csharp
public interface IAIUsageAttribution
{
    IReadOnlyList<UsageSubject> Resolve(AgentSessionId session);
}
```

What a session's usage is attributed to, in the consumer's own domain - opaque to the package. The
package always appends `AgentSessionUsageRecorded` on the session's own stream regardless; this is
what lets a consumer additionally fan usage out into its own domain (Direct: one event per issue a
unit of work covered). Defaults to `NoAttributionAIUsageAttribution` (resolves nothing) when a
consumer has nothing to fan out to.

## Agent execution

```csharp
public interface IAgentExecution
{
    IDisposable As(AgentId agentId, IDictionary<string, string>? extraCausationProperties = null);
    IDisposable As(LanguageModelPurpose purpose, IDictionary<string, string>? extraCausationProperties = null);
}
```

The one call any agent-driven code path makes so that every event it goes on to cause is attributed
to the agent (via Chronicle's `IIdentityProvider`) and carries why the agent was acting (via
Chronicle's `ICausationManager`, under the package's own `Cratis.AI.AgentWork` causation type).
Deliberately does **not** open an authorization scope - that stays a product concern. A consumer
composes it with its own authorization scope by wrapping it:

```csharp
public IDisposable As(AgentId id) =>
    new CompositeScope(systemExecution.AsSystem(), packageAgentExecution.As(id));
```

An unrecognized agent is a safe no-op scope, never a thrown exception - the work being attributed
must never be blocked by attribution itself failing. See decision
[`0001-agent-identity-and-causation.md`](./decisions/0001-agent-identity-and-causation.md).

## Registration and the ordering rule

```csharp
services.AddCratisAI(ai => ai
    .WithSecretProtection<OrganizationSecretProtector>()
    .WithAgents<OrganizationAgents>()
    .WithAlerts<OrganizationAlerts>()               // optional
    .WithUsageAttribution<OrganizationUsageAttribution>()); // optional

builder.AddCratisArc();   // AddCratisAI() MUST run first
builder.AddChronicle();
```

`AddCratisAI()` must be called **before** `AddCratisArc()`/`AddChronicle()`. Arc's type discovery
snapshots the type universe the first time `Types.Instance` is touched, built only from assemblies
whose module initializer had already run by that point. Calling any method on a `Cratis.AI` type
forces the CLR to load the assembly - which runs its module initializer - before anything else can
take that snapshot. Getting the order wrong is silent everywhere else in the framework: a shorter
discovery result reads exactly like a feature nobody wrote. `AddCratisAI()` does not let this stay
silent - it asserts a sentinel type (`Configuration.CratisAISentinel`) is visible in
`Cratis.Types.Types.Instance.All` immediately after registering, and throws a
`CratisAIOrderingViolation` naming the fix if it is not. A consumer that only wants the ordering
guarantee without adopting the rest of the package can call `CratisAIServiceCollectionExtensions.EnsureLoaded()`
directly.
