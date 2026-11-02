// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.AvailableModels.for_RefreshAvailableModels.when_handling;

public class and_discovery_is_unavailable : Specification
{
    static readonly DateTimeOffset _at = new(2026, 9, 20, 10, 0, 0, TimeSpan.Zero);
    object[] _events;

    void Because() => _events = new RefreshAvailableModels(AIProviderId.New()).Handle(
        new ModelCatalogRefresh(AIModelDiscoveryResult.Unavailable("fixture capability limitation"), null, _at)).ToArray();

    [Fact] void should_emit_only_the_unavailable_fact() => _events.Single().ShouldEqual(new AIProviderModelDiscoveryUnavailable("fixture capability limitation", _at));
}
