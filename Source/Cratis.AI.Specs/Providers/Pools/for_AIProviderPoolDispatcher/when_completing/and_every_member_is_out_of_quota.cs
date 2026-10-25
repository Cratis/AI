// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers.Pools.Listing;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Cratis.AI.Providers.Pools.for_AIProviderPoolDispatcher.when_completing;

/// <summary>
/// A pool whose every member is out of quota fails with a reason that says the pool is exhausted and
/// names the providers tried (Cratis/AI#423).
/// </summary>
public class and_every_member_is_out_of_quota : Specification
{
    static readonly AIProviderId _first = AIProviderId.New();
    static readonly AIProviderId _second = AIProviderId.New();

    IAIProviderClient _client;
    ConfiguredAIProvider _firstProvider;
    ConfiguredAIProvider _secondProvider;
    AIProviderPoolDispatcher _dispatcher;
    LanguageModelResult _result;

    void Establish()
    {
        _firstProvider = new ConfiguredAIProvider(_first, AIProviderType.OpenAI, new AIProviderApiKey("k1"));
        _secondProvider = new ConfiguredAIProvider(_second, AIProviderType.OpenAI, new AIProviderApiKey("k2"));

        _client = Substitute.For<IAIProviderClient>();
        _client.Type.Returns(AIProviderType.OpenAI);
        _client.Complete(Arg.Any<string>(), _firstProvider, Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>())
            .Returns(LanguageModelResult.QuotaExhausted("enforced_spend_limit_reached"));
        _client.Complete(Arg.Any<string>(), _secondProvider, Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>())
            .Returns(LanguageModelResult.QuotaExhausted("insufficient_quota"));

        var providerBurn = Substitute.For<IProviderBurn>();
        providerBurn.TrailingWeek(Arg.Any<CancellationToken>()).Returns(new ProviderBurnOverTrailingWeek(
            new Dictionary<AIProviderId, long> { [_first] = 0, [_second] = 100 },
            new Dictionary<AIProviderId, int>()));

        var quotaTracker = Substitute.For<IAIProviderQuotaTracker>();

        _dispatcher = new AIProviderPoolDispatcher([_client], providerBurn, quotaTracker, Substitute.For<Microsoft.Extensions.Logging.ILogger<AIProviderPoolDispatcher>>());
    }

    async Task Because() => _result = await _dispatcher.Complete(
        "prompt",
        [new AIProviderPoolMember(_first), new AIProviderPoolMember(_second)],
        new Dictionary<AIProviderId, ConfiguredAIProvider> { [_first] = _firstProvider, [_second] = _secondProvider },
        new ModelName("gpt"),
        Effort.Medium);

    [Fact] void should_not_succeed() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_be_quota_exhausted() => _result.IsQuotaExhausted.ShouldBeTrue();
    [Fact] void should_not_be_transient() => _result.IsTransient.ShouldBeFalse();
    [Fact] void should_say_the_pool_is_exhausted() => _result.FailureReason.ShouldContain("the pool is exhausted");
    [Fact] void should_name_the_first_provider() => _result.FailureReason.ShouldContain(_first.ToString());
    [Fact] void should_name_the_second_provider() => _result.FailureReason.ShouldContain(_second.ToString());
}
