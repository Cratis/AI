# 0006 - Provider CRUD as the first real migration slice

Status: Accepted (Reconfigure added same day, folded into this record rather than a separate one) -
its `ISecretProtector` choice is superseded by decision 0015, which moves credential encryption to
Chronicle's `[Encrypted]`; the rest of this record stands.
Related: `Providers/Adding/`, `Providers/Renaming/RenameAIProvider.cs`,
`Providers/Removing/RemoveAIProvider.cs`, `Providers/ConfiguredAIProvider.cs`.

## Context

Every PR before this one that touched Direct or Studio was deliberately additive-only: new seams, a
diagnostic endpoint, nothing that replaced or deleted the ~18,300 lines in Direct's
`AIProviders/`/`LanguageModels/`/`Work/` or the ~13,400 lines in Studio's `Settings/AI/`/`Agent/`.
That was a real gap in what "migrating to `Cratis.AI`" was supposed to mean, not a finished job -
`ConfiguredAIProvider` was still the placeholder record its own remarks always said it was: "a
plain, unprojected shape a consumer can construct directly until the full provider-configuration
subsystem lands."

That subsystem is large: provider CRUD (5 vendor Add commands, Reconfigure, Rename, Remove), pool
CRUD, concurrency/tier-model settings, usage reporting and billing reconciliation, subscription
credential refresh, model catalog discovery, rate limiting, harness support, Codex sign-in. Porting
all of it in one PR was not realistic - this is the first slice, chosen because everything else
depends on a provider actually existing as real projected state first.

## Decision

**Ported this PR:** the five vendor Add commands (Anthropic, OpenAI, AzureOpenAI, OpenAICompatible,
ZAI), Rename, Remove, the five matching Reconfigure commands, and `ConfiguredAIProvider` upgraded
from a plain unprojected record to a real `[ReadModel][Passive]` projection built from all of them -
all wired onto the package's own `ISecretProtector` (Direct's `DirectSecretProtector`/Studio's
`StudioSecretProtector` already implement it), not a product-specific encryption pipeline.

**Reconfigure's "blank keeps the existing value" semantics** work by taking the provider's current
`ConfiguredAIProvider` projection as a `Handle(ConfiguredAIProvider? current, ...)` parameter - Arc
resolves it automatically, keyed off the command's own `Provider` property, the same convention
Direct's own donor already proved correct in production. `current is null` (the provider does not
exist) returns a `Cratis.Monads.Result<TEvent, Cratis.Arc.Validation.ValidationResult>` validation
failure rather than throwing - an injected read model that legitimately does not exist yet is a
normal outcome a caller should be able to show, not an exceptional one.

**Deliberately not ported yet, and why:**

- **OpenAI's subscription-credential-kind classification** (`OpenAICredentialKind.EventFor`, a
  second event `AddOpenAIProvider` raises alongside the Added one in Direct). Belongs with the
  not-yet-ported Codex/harness credential subsystem - `AddOpenAIProvider` here still accepts a
  ChatGPT subscription record as a valid API key value (`OpenAI.OpenAICredential` already handles
  that), it just does not yet separately record which kind of credential it is.
- **Pool CRUD, concurrency/tier-model settings, usage reporting, credential refresh, model catalog,
  rate limiting, harness support, Codex sign-in.** Larger, separate slices - none of the concepts
  these need (`AIProviderPoolId`/`Name`/`Member`, `ModelTier`, `TierModels`) lack a real CRUD layer
  either, same gap this PR closes for providers themselves.

## Consequences

- `ConfiguredAIProvider`'s public shape is unchanged (`Id`, `Type`, `ApiKey`, `Endpoint`,
  `MaxConcurrentJobs`) - only additive `[ReadModel]`/`[Passive]`/`[FromEvent]`/`[SetFrom]`/`[SetValue]`
  attributes were added. Every existing caller (`IAIProviderClient` implementations,
  `AIProviderPoolDispatcher`, this package's own specs) that constructs it directly keeps working
  unchanged - real projected state and "a consumer builds one by hand for a test" are the same shape.
- No display name on `ConfiguredAIProvider`, matching Direct's own donor exactly - a name is a
  listing/UI concern (Direct's still-unported `Listing.AIProvider`), not something a vendor client
  making a call needs.
- Direct and Studio do not consume any of this yet - their own provider CRUD stays live and
  untouched. Provider Add/Reconfigure/Rename/Remove is now a complete command surface in the
  package; what still blocks an actual cutover is everything listed above (pool CRUD, tier/
  concurrency settings, usage reporting, credential refresh, model catalog, rate limiting, Codex),
  plus `Listing.AIProvider` for a UI to actually show someone their configured providers by name.

## Alternatives rejected

- **Requiring every field on every Reconfigure call**, dropping the "blank keeps existing" UX both
  donors' users are used to. Rejected - silently changing a user-facing contract during a "just
  moving code" migration is exactly the kind of surprise this package's approach exists to avoid.
  `Handle(ConfiguredAIProvider? current, ...)` reading the projection directly costs nothing extra
  and keeps the real contract intact.
- **Shipping Add/Rename/Remove alone and deferring Reconfigure to its own PR.** The original plan
  for this PR, reconsidered mid-flight: half a CRUD surface is not a shippable unit on its own terms
  either, and the "read current state in a command handler" pattern Reconfigure needed was a small,
  well-proven addition (Direct's own donor already exercises it in production) rather than the open
  design question it first looked like.
