// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using NSubstitute;

namespace Cratis.AI.Providers.Pools.for_AIProviderPoolDispatcher.when_completing;

public class and_every_member_fails_transiently : Specification
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
            .Returns(LanguageModelResult.TransientFailure("still rate limited"));

        var providerBurn = Substitute.For<IProviderBurn>();
        providerBurn.TrailingWeek(Arg.Any<CancellationToken>()).Returns(new ProviderBurnOverTrailingWeek(
            new Dictionary<AIProviderId, long>(),
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

    [Fact] void should_not_have_succeeded() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_carry_the_last_members_failure_reason() => _result.FailureReason.ShouldEqual("still rate limited");
    [Fact] void should_have_tried_both_members() => _client.Received(2).Complete(Arg.Any<string>(), Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>());
}
