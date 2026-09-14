# 0001 - Agent identity and causation are first-class package concerns

Status: Accepted
Related: `/Volumes/Code/Cratis/ai-consolidation-plan.md` Section 5.1 (Abstractions), Section 5.3
(usage subsystem), risk table items on attribution.

## Context

The consolidation plan's Abstractions sketch (Section 5.1) lists `IAIIdentityProvider` as "who is
asking - used for attribution on usage events" and leaves it at that. Investigating both donor
repositories during Phase 3 Step 1 found a materially different, and more specific, situation:

- **Chronicle already has two separate, purpose-built mechanisms for this** -
  `Cratis.Chronicle.Identities.IIdentityProvider` (who an appended event is attributed to,
  `EventContext.CausedBy`) and `Cratis.Chronicle.Auditing.ICausationManager` (the chain of context
  that led to an append, e.g. `Cratis.Chronicle.AspNetCore.Auditing.CausationMiddleware` for HTTP
  requests). They are deliberately distinct: identity is a single value on an appended event,
  causation is a stack of context that can nest and unwind.
- **Direct already has a mature, production-hardened implementation over both**: `Identity.AgentIdentity`
  (maps an agent to a Chronicle `Identity`), `Identity.EventIdentityProvider` (a
  `BaseIdentityProvider` that prefers an explicitly-established agent identity over the HTTP request
  principal - load-bearing, because worker callbacks *are* HTTP requests, authenticated by a bearer
  token, and would otherwise attribute everything a worker container did to `[System]`),
  `Identity.IAgentExecution` / `Identity.AgentExecution` (the one call that opens both the identity
  scope and, composed with Arc's `ISystemExecution`, an authorization scope), and
  `Common.AgentWorkCausation` (a `CausationType` carrying provider/model/effort/prompts, opened via
  `ICausationManager.BeginScope` around dispatching a unit of work).
- **Studio has none of this.** No `IAgentExecution` equivalent, no causation type for agent work. Its
  conversational `ChatClient` path presumably attributes everything it causes to whatever Chronicle
  identity provider Studio has wired for HTTP requests generally - there is no agent-specific
  attribution and no causation trail explaining why the events were produced.

This was raised explicitly during the consolidation session: every task an agent performs that
produces events must be attributed to the agent as an identity, not to an undifferentiated system or
to the human who happened to be signed in when a background job ran. Chronicle's causation mechanism
should also be used, the way Direct already uses it, so an event's causation chain says *why* an
agent acted (which provider, model, purpose, session) and not only *who* acted.

## Decision

`Cratis.AI`'s Abstractions layer (Section 5.1) is extended, beyond the plan's original one-line
`IAIIdentityProvider` sketch, with:

1. **`Agents.AgentId` / `Agents.AgentName`** - minimal identity concepts, ported from Direct's
   `Agents.AgentId`. Brought into Abstractions rather than deferred to Section 5.5's full agent-model
   reconciliation, because `IAgentExecution` cannot be expressed without them.
2. **`Agents.AgentIdentity`** - maps an agent onto a Chronicle `Identity`, ported from Direct's
   `Identity.AgentIdentity` verbatim in spirit (subject = the agent's own id, distinct namespace from
   any human subject space a consumer's own identity provider resolves).
3. **`Agents.AIAgentCausation`** - a package-owned `CausationType` (`"Cratis.AI.AgentWork"`),
   generalized from Direct's `Common.AgentWorkCausation`. Carries agent id/name/purpose/session as a
   base set; callers merge in richer context (provider, model, effort - concepts that move into the
   package in Section 5.2/5.3, not yet available at the Abstractions layer) via an `extra` properties
   dictionary rather than the type depending on them.
4. **`Abstractions.IAIAgents`** - the lookup seam the coupling table in Section 2.2 already names but
   leaves unspecified ("Agent model moves into the package, or an `IAIAgents` lookup abstraction").
   Resolves an `AgentId` or `LanguageModelPurpose` to a minimal `AgentDescriptor` (id + name). Direct
   and Studio each implement it over their own agent catalog until Section 5.5 lands a shared model.
5. **`Agents.IAgentExecution` / `Agents.AgentExecution`** - the one call that opens both the identity
   scope (via any Chronicle `IIdentityProvider`) and the causation scope (via `ICausationManager`)
   together, so a call site cannot establish one and forget the other. Deliberately narrower than
   Direct's own `IAgentExecution`: it does not open an authorization scope. Authorization is a product
   concern (Direct: Arc's `ISystemExecution`; Studio may differ) - a consumer composes the package's
   `IAgentExecution` with its own authorization scope by wrapping it, the way Direct's original
   `AgentExecution` already composed `ISystemExecution` and `EventIdentityProvider` as two constructor
   dependencies. The package owns the part that is genuinely shared and easy to get out of sync
   (identity + causation together); it does not own the part that is genuinely product-specific
   (authorization).
6. Unknown-agent behaviour matches Direct's precedent: `IAgentExecution.As(...)` on an unrecognized
   `AgentId`/`LanguageModelPurpose` is a no-op scope, not a thrown exception. The work an agent-driven
   code path is trying to attribute must never be blocked by attribution itself failing.

## Consequences

- Studio gains agent identity and causation attribution for free once it adopts `Cratis.AI` and
  supplies `IAIAgents` and (optionally) wraps `IAgentExecution` with its own authorization scope -
  something it does not have today. This was not explicitly called out as a Studio gap in the original
  plan's Section 5.8 "Studio gains, for free" list and should be added there.
- When Direct migrates (Section 5.7), its own `Identity.AgentExecution`, `Identity.AgentIdentity`,
  `Identity.EventIdentityProvider` and `Common.AgentWorkCausation` are deleted and replaced by a thin
  adapter that composes the package's `IAgentExecution` with Direct's existing `ISystemExecution`
  authorization scope - the doc-comment reasoning on `Identity.EventIdentityProvider` (why an agent
  scope must win over the HTTP request principal for worker callbacks) moves onto whatever Direct's
  new adapter or `IIdentityProvider` implementation is, since it is still the load-bearing reasoning
  even though the mechanism doing the work moved into the package.
- `Cratis.AI.Specs` (a sibling, `IsPackable=false` project per the plan's recommendation in Section
  4.1) opened with `Agents/for_AgentExecution/*` specs proving: a known agent's identity and causation
  are both established during the scope; an unknown agent is a safe no-op; nested scopes restore the
  outer scope's identity on the inner scope's disposal (mirroring `ICausationManager.BeginScope`'s own
  last-in-first-out guarantee, which the identity restore piggybacks on).

## Alternatives rejected

- **Package owns authorization too.** Rejected: authorization is genuinely product-specific (Arc's
  `ISystemExecution` is a Direct/Arc concept; Studio's authorization story may not be the same shape),
  and forcing it into the package would recreate exactly the kind of donor-specific coupling Section
  5.1's rules say the package must not have ("the package never references `Direct.*` or `Studio.*`").
- **Reuse Direct's `IAgentExecution` name and shape unmodified, including the authorization call.**
  Rejected for the same reason - it would require the package to depend on `Cratis.Arc.Authorization`'s
  `ISystemExecution` unconditionally, which not every consumer of `Cratis.AI` (a worker host with no
  HTTP surface, for instance) necessarily has a meaningful implementation of.
- **A single `IAIIdentityProvider` abstraction as originally sketched, competing with Chronicle's own
  `IIdentityProvider`.** Rejected: Chronicle already has the right seam; inventing a parallel one
  would give a consumer two identity mechanisms to keep in sync for no benefit. `Cratis.AI` depends on
  `Cratis.Chronicle.Identities.IIdentityProvider` directly instead.
