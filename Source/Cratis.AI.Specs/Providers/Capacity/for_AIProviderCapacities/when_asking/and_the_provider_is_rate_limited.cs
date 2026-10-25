// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacities.when_asking;

public class and_the_provider_is_rate_limited : given.all_dependencies
{
    AIProviderCapacity _capacity;

    void Establish()
    {
        ProviderIs(new ConfiguredAIProvider(_provider, AIProviderType.OpenAI, "sk-test") { RateLimitedUntil = _now.AddHours(3) });
        _reporter.CanReport(Arg.Any<ConfiguredAIProvider>()).Returns(false);
    }

    async Task Because() => _capacity = await _capacities.For(_provider);

    [Fact] void should_not_let_work_start() => _capacity.CanStartWork.ShouldBeFalse();
    [Fact] void should_be_available_again_when_the_limit_lifts() => _capacity.AvailableAgainAt.ShouldEqual(_now.AddHours(3));
}
