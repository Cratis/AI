// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.SettingTierModels;

namespace Cratis.AI.Providers.AvailableModels.for_RefreshAvailableModels.when_handling;

/// <summary>
/// Registration's shape: two events on one stream. The vendor's catalog is one fact, and the tier
/// mapping Direct derived from it is another - which is what makes a freshly added provider usable
/// without anybody opening its settings (#1187).
/// </summary>
public class and_the_provider_has_no_mapping_of_its_own : Specification
{
    static readonly DateTimeOffset _at = new(2026, 9, 20, 10, 0, 0, TimeSpan.Zero);

    IEnumerable<object> _result;

    void Because() => _result = new RefreshAvailableModels(AIProviderId.New()).Handle(
        new ModelCatalogRefresh(
            AIModelDiscoveryResult.Discovered(
            [
                new ModelName("claude-opus-4-5"),
                new ModelName("claude-sonnet-4-5"),
                new ModelName("claude-haiku-4-5"),
            ]),
            null,
            _at));

    [Fact] void should_append_two_events() => _result.Count().ShouldEqual(2);

    [Fact]
    void should_record_the_catalog_exactly_as_published() =>
        _result.OfType<AIProviderModelsDiscovered>().Single().Models.ShouldContainOnly(
            new ModelName("claude-opus-4-5"),
            new ModelName("claude-sonnet-4-5"),
            new ModelName("claude-haiku-4-5"));

    [Fact] void should_stamp_the_discovery() => _result.OfType<AIProviderModelsDiscovered>().Single().DiscoveredAt.ShouldEqual(_at);

    [Fact]
    void should_derive_the_tier_mapping_from_the_catalog() =>
        _result.OfType<AIProviderTierModelsSet>().Single().Models.Powerful.ShouldEqual(new ModelName("claude-opus-4-5"));
}
