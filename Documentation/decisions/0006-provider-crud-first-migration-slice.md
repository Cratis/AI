# 0006 - Provider CRUD as the first real migration slice

Status: Accepted
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
ZAI), Rename, Remove, and `ConfiguredAIProvider` upgraded from a plain unprojected record to a real
`[ReadModel][Passive]` projection built from them - all wired onto the package's own
`ISecretProtector` (Direct's `DirectSecretProtector`/Studio's `StudioSecretProtector` already
implement it), not a product-specific encryption pipeline.

**Deliberately not ported yet, and why:**

- **Reconfigure** (Anthropic/OpenAI/AzureOpenAI/OpenAICompatible/ZAI). Both donors' Reconfigure
  commands support "leave this field blank to keep the existing value," which means reading the
  provider's current `ConfiguredAIProvider` projection inside the command handler and substituting
  the old value before emitting the event. That needs its own careful design pass (how a `[Passive]`
  read model is resolved from inside a command handler in this package, not yet established anywhere
  else in it) rather than a rushed copy - tracked as the very next piece of this slice.
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
  untouched until Reconfigure exists too and a real cutover can replace a whole command surface at
  once, not half of one.

## Alternatives rejected

- **Porting Reconfigure in the same PR by requiring every field on every call**, dropping the
  "blank keeps existing" UX both donors' users are used to. Rejected - silently changing a
  user-facing contract during a "just moving code" migration is exactly the kind of surprise this
  package's port-first-cutover-second approach exists to avoid; better to ship Add/Rename/Remove
  alone and get Reconfigure's real semantics right next.
