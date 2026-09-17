// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.Compliance.GDPR;
using Cratis.Concepts;

namespace Cratis.AI.Providers.for_AIProviderApiKey;

/// <summary>
/// The broader guard behind Cratis/Direct#998's regression (see
/// <see cref="when_checking_compliance_metadata"/> for that specific type): a <see cref="string"/>
/// Concept whose name looks like a credential and carries no <see cref="PIIAttribute"/> is exactly
/// the shape of the defect that shipped once already. This scans every <see cref="ConceptAs{T}"/> of
/// <see cref="string"/> in the package rather than naming <see cref="AIProviderApiKey"/> a second
/// time, so a future credential Concept is caught the same way even if nobody remembers to extend a
/// hand-written list.
/// </summary>
/// <remarks>
/// <para>
/// Restricted to <see cref="ConceptAs{T}"/> of <see cref="string"/> - a credential is always textual
/// - rather than every Concept regardless of underlying type. Without that restriction the name
/// fragment "Token" also matches <c>Usage.CachedTokens</c>/<c>InputTokens</c>/<c>OutputTokens</c>, the
/// <see cref="ConceptAs{T}"/> of <see cref="long"/> language-model usage counters: real Concepts, real
/// name collisions, and rightly unmarked, because a token count is not a secret.
/// </para>
/// <para>
/// Non-vacuous by construction, per this repository's guards-and-fuses rule: the matcher's own hit
/// count is asserted first, so a naming change that made the pattern stop matching anything would
/// fail loudly here rather than silently passing an empty scan.
/// </para>
/// </remarks>
public class when_scanning_the_assembly_for_unmarked_credential_concepts : Specification
{
    static readonly string[] _credentialNameFragments = ["ApiKey", "Secret", "Token", "Credential", "Password"];

    IReadOnlyList<Type> _candidates;
    IReadOnlyList<Type> _unmarked;

    void Establish() =>
        _candidates = [.. typeof(AIProviderApiKey).Assembly.GetTypes()
            .Where(type => IsStringConcept(type) && LooksLikeACredential(type))];

    void Because() =>
        _unmarked = [.. _candidates.Where(type => !Attribute.IsDefined(type, typeof(PIIAttribute)))];

    [Fact]
    void should_find_at_least_one_credential_shaped_concept_to_check() =>
        _candidates.Count.ShouldBeGreaterThan(0);

    [Fact]
    void should_find_none_of_them_unmarked() =>
        _unmarked.ShouldBeEmpty();

    static bool LooksLikeACredential(Type type) =>
        _credentialNameFragments.Any(fragment => type.Name.Contains(fragment, StringComparison.Ordinal));

    static bool IsStringConcept(Type type)
    {
        var current = type.BaseType;
        while (current is not null)
        {
            if (current.IsGenericType &&
                current.GetGenericTypeDefinition() == typeof(ConceptAs<>) &&
                current.GetGenericArguments()[0] == typeof(string))
            {
                return true;
            }

            current = current.BaseType;
        }

        return false;
    }
}
