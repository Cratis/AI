// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.SettingTierModels;

namespace Cratis.AI.Providers.AvailableModels.for_RefreshAvailableModels.when_handling;

/// <summary>
/// A failed ask is recorded rather than swallowed. Left silent it is indistinguishable from a
/// provider that serves no models, and the surface renders both as an empty dropdown with nothing to
/// act on - which is exactly what pressing Refresh used to produce.
/// </summary>
public class and_the_vendor_could_not_be_asked : Specification
{
    static readonly DateTimeOffset _at = new(2026, 9, 20, 10, 0, 0, TimeSpan.Zero);

    IEnumerable<object> _result;

    void Because() => _result = new RefreshAvailableModels(AIProviderId.New()).Handle(
        new ModelCatalogRefresh(AIModelDiscoveryResult.Failed("Anthropic returned HTTP 401."), null, _at));

    [Fact] void should_append_only_the_failure() => _result.Count().ShouldEqual(1);

    [Fact] void should_record_why() => _result.OfType<AIProviderModelDiscoveryFailed>().Single().Reason.ShouldEqual("Anthropic returned HTTP 401.");

    [Fact] void should_stamp_the_attempt() => _result.OfType<AIProviderModelDiscoveryFailed>().Single().AttemptedAt.ShouldEqual(_at);

    [Fact] void should_not_derive_a_mapping_from_nothing() => _result.OfType<AIProviderTierModelsSet>().ShouldBeEmpty();

    [Fact] void should_not_erase_the_catalog_it_already_had() => _result.OfType<AIProviderModelsDiscovered>().ShouldBeEmpty();
}
