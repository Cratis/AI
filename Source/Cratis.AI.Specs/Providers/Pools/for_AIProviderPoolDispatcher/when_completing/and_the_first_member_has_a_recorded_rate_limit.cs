// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;
using Cratis.AI.Providers.Pools.Listing;

namespace Cratis.AI.Providers.Pools.for_AIProviderPoolDispatcher.when_completing;

/// <summary>
/// A member already known to be over its own usage limit is skipped before it is called, rather than
/// asked again only to be turned away - the same check the completion path makes.
/// </summary>
public class and_the_first_member_has_a_recorded_rate_limit : Specification
{
    static readonly AIProviderId _first = AIProviderId.New();
    static readonly AIProviderId _second = AIProviderId.New();
    static readonly DateTimeOffset _now = new(2026, 10, 7, 12, 0, 0, TimeSpan.Zero);

    IAIProviderClient _client;
    ConfiguredAIProvider _firstProvider;
    ConfiguredAIProvider _secondProvider;
    AIProviderPoolDispatcher _dispatcher;
    LanguageModelResult _result;

    void Establish()
    {
        _firstProvider = new ConfiguredAIProvider(_first, AIProviderType.OpenAI, new AIProviderApiKey("k1")) { RateLimitedUntil = _now.AddDays(2) };
        _secondProvider = new ConfiguredAIProvider(_second, AIProviderType.OpenAI, new AIProviderApiKey("k2"));

        _client = Substitute.For<IAIProviderClient>();
        _client.Type.Returns(AIProviderType.OpenAI);
        _client.Complete(Arg.Any<string>(), Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>())
            .Returns(LanguageModelResult.Success("ok"));

        var providerBurn = Substitute.For<IProviderBurn>();
        providerBurn.TrailingWeek(Arg.Any<CancellationToken>()).Returns(new ProviderBurnOverTrailingWeek(
            new Dictionary<AIProviderId, long> { [_first] = 0, [_second] = 100 },
            new Dictionary<AIProviderId, int>()));

        var timeProvider = Substitute.For<TimeProvider>();
        timeProvider.GetUtcNow().Returns(_now);

        _dispatcher = new AIProviderPoolDispatcher([_client], providerBurn, Substitute.For<IAIProviderQuotaTracker>(), timeProvider, Substitute.For<Microsoft.Extensions.Logging.ILogger<AIProviderPoolDispatcher>>());
    }

    async Task Because() => _result = await _dispatcher.Complete(
        "prompt",
        [new AIProviderPoolMember(_first), new AIProviderPoolMember(_second)],
        new Dictionary<AIProviderId, ConfiguredAIProvider> { [_first] = _firstProvider, [_second] = _secondProvider },
        new ModelName("gpt"),
        Effort.Medium);

    [Fact] void should_succeed() => _result.Succeeded.ShouldBeTrue();
    [Fact] void should_not_have_tried_the_rate_limited_member() => _client.DidNotReceive().Complete("prompt", _firstProvider, Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>());
    [Fact] void should_have_tried_the_second_member() => _client.Received(1).Complete("prompt", _secondProvider, Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>());
}
