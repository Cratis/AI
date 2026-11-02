// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.AvailableModels.for_RefreshAvailableModels.when_handling;

public class and_the_unavailable_observation_changes : Specification
{
    [Theory]
    [InlineData(AIModelDiscoveryStatus.Unavailable, "previous limitation")]
    [InlineData(AIModelDiscoveryStatus.Failed, "current limitation")]
    [InlineData(AIModelDiscoveryStatus.Discovered, "current limitation")]
    public void should_record_a_changed_status_or_reason(AIModelDiscoveryStatus status, string reason)
    {
        var at = new DateTimeOffset(2026, 9, 20, 10, 0, 0, TimeSpan.Zero);
        var events = new RefreshAvailableModels(AIProviderId.New()).Handle(new(
            AIModelDiscoveryResult.Unavailable("current limitation"), null, at, status, reason));
        events.Single().ShouldEqual(new AIProviderModelDiscoveryUnavailable("current limitation", at));
    }
}
