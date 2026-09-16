// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using NSubstitute;

namespace Cratis.AI.Providers.Pools.for_AIProviderPoolDispatcher.when_completing;

/// <summary>
/// The other half of Cratis/AI#337: a member already known, from its own last-reported quota
/// headers, to be exhausted is skipped without ever being called - not learned about only after a
/// wasted round trip and a 429.
/// </summary>
public class and_the_first_member_is_known_exhausted : Specification
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
        _client.Complete(Arg.Any<string>(), Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>())
            .Returns(LanguageModelResult.Success("ok"));

        var providerBurn = Substitute.For<IProviderBurn>();
        providerBurn.TrailingWeek(Arg.Any<CancellationToken>()).Returns(new ProviderBurnOverTrailingWeek(
            new Dictionary<AIProviderId, long> { [_first] = 0, [_second] = 100 },
            new Dictionary<AIProviderId, int>()));

        var quotaTracker = Substitute.For<IAIProviderQuotaTracker>();
        quotaTracker.IsKnownExhausted(_first).Returns(true);

        _dispatcher = new AIProviderPoolDispatcher([_client], providerBurn, quotaTracker, Substitute.For<Microsoft.Extensions.Logging.ILogger<AIProviderPoolDispatcher>>());
    }

    async Task Because() => _result = await _dispatcher.Complete(
        "prompt",
        [new AIProviderPoolMember(_first), new AIProviderPoolMember(_second)],
        new Dictionary<AIProviderId, ConfiguredAIProvider> { [_first] = _firstProvider, [_second] = _secondProvider },
        new ModelName("gpt"),
        Effort.Medium);

    [Fact] void should_succeed() => _result.Succeeded.ShouldBeTrue();

    [Fact]
    void should_never_have_called_the_exhausted_member() =>
        _client.DidNotReceive().Complete(Arg.Any<string>(), _firstProvider, Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>());

    [Fact]
    void should_have_called_the_other_member() =>
        _client.Received(1).Complete(Arg.Any<string>(), _secondProvider, Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>());
}
