# 0015 - Chronicle owns credential encryption; the protector seams are removed

Status: Accepted
Supersedes: the `ISecretProtector`/`ISecretRevealer` parts of decision 0006 and decision 0014.
Related: `Providers/AIProviderApiKey.cs`, `Abstractions/`, decision 0002, decision 0007.

## Context

Decision 0006 gave the package its own `ISecretProtector`/`ISecretRevealer` seam so a provider
credential could be protected at rest without the package ever referencing Direct's
`Tenants.Encryption` or Studio's `Organizations.Encryption`. That reasoning was sound and the
constraint it protected still holds. Two things have changed since.

**Chronicle grew `[Encrypted]`.** It did not exist when 0006 was written. `[Encrypted]` encrypts a
value on its way into an event and decrypts it on the way back out, keyed by a scope the attribute
names. It lives in `Cratis.Chronicle.ProtectedValues`, in the client package this one already
referenced - so adopting it costs no new dependency and still never references a product's vault.

**The seam leaked the thing it existed to protect.** Protection happened *inside* `Handle`, but Arc
writes a command's property values to the causation chain *before* `Handle` runs. `AIProviderApiKey`
carried no `[NotAudited]`, so every provider command wrote its key to the event log in plain text,
permanently. This was not theoretical: fourteen such entries were found in Direct's production log,
six of them real Anthropic keys. The event *content* was protected exactly as designed; the audit
trail beside it was not.

`EncryptionScope.Namespace` is not an approximation of what the protectors did - it is the same
boundary. Direct's `ITenantEncryptionKeys` resolves its key by `EventStoreNamespaceName`, and
Studio's `OrganizationEncryptionKeys` resolves the organization's key with the tenant id
"doubling as the organization's namespace name".

## Decision

`AIProviderApiKey` carries `[Encrypted(EncryptionScope.Namespace)]` and `[NotAudited]`.
`ISecretProtector`, `ISecretRevealer` and `CratisAIBuilder.WithSecretProtection<T>()` are removed;
no handler protects a value and no caller reveals one. The package takes a direct reference on
`Cratis.Arc.Chronicle` for `[NotAudited]`, which also enables the `ARCCHR` analyzers - `ARCCHR0009`
now fails the build if a command carries a credential-shaped property that is not excluded from the
causation chain, which is the check that would have caught this from the start.

Handlers that only existed to `await` a protector became synchronous, and `AIUsageReporting` reads
the usage key straight off the read model because Chronicle decrypts on read.

## Consequences

**Breaking, and it is a data change, not just an API change.** Values already stored through the old
protectors are `enc:v1:`-wrapped strings that Chronicle does not recognize. It passes unrecognized
values through untouched, so they are neither decrypted nor corrupted - they are simply no longer
readable by anything, because the code that could unwrap them is gone. **Every consuming product
must re-record its provider credentials after upgrading.** Direct and Studio each own that step.

A host that called `.WithSecretProtection<T>()` must delete the call. Direct's `DirectSecretProtector`
and Studio's `StudioSecretProtector` have no remaining implementee and should go. Direct's
`ISecurityTokenProtector` has no other consumer and can go with it; Studio's still carries its GitHub
App key and MCP credentials and stays until those move too.

Key custody moves from each product's vault to Chronicle's `IEncryptionKeyStorage`. The boundary is
unchanged; the custodian is not.

Decision 0002's pinned event-type ids are untouched by this record - but the twenty ids whose value
was literally their own type name were removed as redundant (`ARCCHR0004`); the identifier each one
resolves to is unchanged, because the type name is the default.
