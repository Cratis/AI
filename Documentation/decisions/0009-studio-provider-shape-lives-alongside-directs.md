# 0009 - Studio's provider shape lives alongside Direct's, not instead of it

Status: Accepted
Related: decision 0006 (provider CRUD, Direct's shape), decisions 0007/0008 (event id pinning),
`Providers/Configuring/`.

## Context

Studio's provider cutover hit a wall Direct's did not: Studio's real, already-stored provider events
are not just differently *named* from what decision 0006 ported - they are differently *shaped*.

- Direct: two events per vendor (`XProviderAdded`, `XProviderReconfigured`), a `MaxConcurrentJobs`
  bound, no model identifier (an agent supplies the model).
- Studio: **one** event per vendor (`XModelConfigured`, e.g. `AnthropicModelConfigured`) that fires on
  both add and reconfigure, a `Model`/`DeploymentName` identifier, no concurrency bound at all.
- Even the vendor-agnostic ones differ: Direct's `AIProviderRenamed`/`AIProviderRemoved` versus
  Studio's `AIModelRenamed`/`AIModelRemoved`.

Cutting Studio over onto decision 0006's commands as they stood would have written new providers
under event types Studio's own real projections never learned to read - not a naming problem
decision 0008's id-matching trick could fix, since the shapes themselves genuinely differ (a `Model`
field with no Direct equivalent, one event doing the job of two).

## Decision

Studio's provider commands live in their own `Cratis.AI.Providers.Configuring` namespace, matching
Studio's real shape exactly rather than forcing it into Direct's: `AddXProvider`/`ReconfigureXProvider`
per vendor (Anthropic, OpenAI, AzureOpenAI, OpenAICompatible - Studio has no ZAI provider), both
raising the one shared `XModelConfigured` event; vendor-agnostic `RenameAIProvider`/`RemoveAIProvider`
raising `AIModelRenamed`/`AIModelRemoved`. Every event id is pinned to the literal string Studio's own
pre-migration same-named type already resolves to implicitly - the same reasoning decision 0008
established for Direct, applied to Studio's actual names this time.

`ConfiguredAIProvider` (the one shared projection both `Adding`/`Reconfiguring` and `Configuring`
accumulate into) gained a `Model` field alongside the existing `MaxConcurrentJobs` - each is the other
donor's concept with no equivalent, both nullable, both simply unset when their owning product's
events never mention them. `[FromEvent]`/`[SetFrom]`/`[SetValue]`/`[RemovedWith]` (the last one now
attributed twice, once per donor's removal event - `Chronicle`'s attribute allows it) accumulate from
both event families into the same `Id`/`Type`/`ApiKey`/`Endpoint` fields.

`@cratis/ai`'s generated barrel re-exports Direct's shape flatly (unchanged - no breaking change to
what Direct already imports) and reaches Studio's shape through a `Configuring` namespace import,
since the two families share command names (`AddAnthropicProvider`, `RenameAIProvider`, ...) that
would otherwise collide in a flat re-export.

## Consequences

- This is the general pattern for whenever a future subsystem finds the same situation: Direct and
  Studio are not the same product wearing different names, and a package meant to serve both has to
  be honest about the cases where their real domain models genuinely differ, the same way
  `DirectAIAgents`/`StudioAIAgents` already are two real adapters rather than one forced shape.
- `ReconfigureOpenAICompatibleProvider`'s current-provider null check is a deliberate improvement over
  Studio's own version, which omits it (an existing minor inconsistency in Studio's own code, not
  worth replicating into a fresh implementation) - reconfiguring a provider that no longer exists is a
  validation failure for every other vendor in this package, and there was no reason for this one to
  differ once it was being written fresh.
- The Anthropic-key cross-validation rules (`.Must(...)` checking a key does or does not look
  Anthropic-shaped) triggered a real Arc analyzer warning (ARC0013 - a concept property may be null at
  validation time) that a `.When()` guard did not silence, even though the guard is a genuine, correct
  runtime protection (FluentValidation's `.When()` skips the whole rule, selector included, when its
  condition is false). Believed to be a static-analysis limitation - the analyzer cannot trace that a
  `.When()` on the same rule protects the dereference in its own `Must` - rather than a real gap;
  logged as a known, accepted warning rather than chased further, consistent with the same call this
  package already makes for its other baseline analyzer noise (`MA0048`, `SA1402`, `SA1649`).

## Alternatives rejected

- **Forcing Studio onto Direct's shape** (decision 0008's original attempt). Rejected: would have
  silently stopped Studio's own projections from seeing new providers/reconfigurations the moment
  Studio's own duplicate commands were deleted - a real functional break, not a cosmetic one.
- **An event-evolution migration moving Studio's historical events onto Direct's shape.** Rejected as
  unnecessary risk for a problem that does not require touching stored data at all - carrying both
  real shapes achieves the same "one shared package" outcome without an event-evolution procedure
  anywhere in the picture.
