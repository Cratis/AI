// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.Compliance.GDPR;

namespace Cratis.AI.Providers;

/// <summary>
/// The API key a configured AI provider authenticates with. Ported from Direct's
/// <c>AIProviders.AIProviderApiKey</c> (plan Section 5.2 step 3), deliberately without Direct's
/// original <c>[SecurityToken]</c> attribute: that attribute is tied to Direct's own
/// <c>Tenants.Encryption</c> pipeline, which the package must never reference (plan Section 5.1's
/// rule, and risk #10 - "the package never sees a key vault, never logs a credential"). Protection
/// is explicit instead: a command handler that persists this value calls
/// <see cref="Abstractions.ISecretProtector.Protect"/> itself before it reaches an event, and a
/// caller that needs the plaintext back calls <see cref="Abstractions.ISecretRevealer.Reveal"/>.
/// Direct and Studio each supply the vault behind those two interfaces.
/// </summary>
/// <remarks>
/// <para>
/// <b><see cref="PIIAttribute"/> is a deliberate compromise, not the semantically clean answer.</b>
/// An API key is a secret, not personal data, so by this corpus's own vocabulary
/// <c>Cratis.Arc.Chronicle.Commands.NotAuditedAttribute</c> is the marking greenfield code should
/// reach for. It is not enough here: Direct's original <c>AIProviders.AIProviderApiKey</c> carried
/// <see cref="PIIAttribute"/> (alongside its now-dropped <c>[SecurityToken]</c>) specifically because
/// some already-stored provider events predate Direct's tenant-key protection and decrypt only
/// through Chronicle's own GDPR crypto-shredding scheme. Dropping the marking would (a) strand those
/// values undecryptable and (b) change this property's generated JSON schema (Chronicle's schema
/// comparison folds compliance metadata into the exact-match it runs against the already-registered
/// schema, per <c>JsonSchemaCompatibilityExtensions.IsCompatibleWith</c>), which the pinned event-type
/// ids this package's provider CRUD relies on cannot tolerate. <see cref="PIIAttribute"/> alone
/// already keeps this value off a command's causation chain too -
/// <c>Cratis.Arc.Chronicle.Commands.CommandCausationValues</c> excludes any property Chronicle's own
/// compliance metadata provider recognizes, which a type-level <see cref="PIIAttribute"/> satisfies -
/// so stacking <c>[NotAudited]</c> on top would add nothing and only muddy which marking is doing the
/// work. This is a restored regression: the port that split this type out of Direct
/// (Cratis/Direct#998) dropped both attributes, which put every subsequent Add/Reconfigure command's
/// plaintext key on the causation chain until this fix restored <see cref="PIIAttribute"/>.
/// </para>
/// </remarks>
/// <param name="Value">The underlying value - protected once a command has called
/// <see cref="Abstractions.ISecretProtector.Protect"/>, plaintext only in flight before that point.</param>
[PII]
public record AIProviderApiKey(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing no API key.
    /// </summary>
    public static readonly AIProviderApiKey NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="AIProviderApiKey"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AIProviderApiKey(string value) => new(value);
}
