// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Reflection;

namespace Cratis.AI.Providers.when_exposing_configured_providers_to_clients;

/// <summary>
/// Arc turns every public static method on a [ReadModel] into an HTTP query, so a credential-bearing
/// read model gaining one silently publishes the secret. This is the structural guard for the split
/// between the client-facing listing (no credential) and the server-only resolving model (credential,
/// no queries) - the same guard Studio carries for its AI provider credentials, ported because the
/// mistake it prevents has been made before.
/// </summary>
public class the_credential_split_holds : Specification
{
    [Fact]
    void should_expose_no_queries_on_the_credential_bearing_model() =>
        typeof(ConfiguredAIProvider)
            .GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.DeclaredOnly)
            .Where(method => !method.IsSpecialName)
            .ShouldBeEmpty();

    [Fact]
    void should_carry_no_credential_on_the_client_facing_model() =>
        typeof(Listing.AIProvider)
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(property => property.PropertyType == typeof(AIProviderApiKey))
            .ShouldBeEmpty();

    [Fact]
    void should_carry_no_credential_on_the_pool_listing_model() =>
        typeof(Pools.Listing.AIProviderPool)
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(property => property.PropertyType == typeof(AIProviderApiKey))
            .ShouldBeEmpty();
}
