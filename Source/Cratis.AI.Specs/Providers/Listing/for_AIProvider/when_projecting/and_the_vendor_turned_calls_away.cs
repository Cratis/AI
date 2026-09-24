// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Adding;
using Cratis.AI.Providers.RateLimiting;

namespace Cratis.AI.Providers.Listing.for_AIProvider.when_projecting;

/// <summary>
/// A provider the vendor is currently refusing looks exactly like a healthy idle one on the settings
/// page - same name, same tag, no calls served either way. Carrying the cooldown here is what lets
/// the page tell those two apart.
/// </summary>
public class and_the_vendor_turned_calls_away : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();
    static readonly DateTimeOffset _until = new(2026, 9, 21, 16, 11, 40, TimeSpan.Zero);

    ReadModelScenario<AIProvider> _scenario;

    void Establish() => _scenario = new();

    async Task Because() => await _scenario.Given.ForEventSource(_providerId).Events(
        new AnthropicProviderAdded("Einars Claude", "sk-ant-key", 4),
        new AIProviderRateLimited(_until));

    [Fact] void should_say_when_the_vendor_is_worth_trying_again() => _scenario.Instance.RateLimitedUntil.ShouldEqual(_until);
}
