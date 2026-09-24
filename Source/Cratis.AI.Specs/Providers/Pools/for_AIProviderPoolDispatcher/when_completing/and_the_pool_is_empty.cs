// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Cratis.AI.Providers.Pools.for_AIProviderPoolDispatcher.when_completing;

public class and_the_pool_is_empty : Specification
{
    AIProviderPoolDispatcher _dispatcher;
    LanguageModelResult _result;

    void Establish()
    {
        var providerBurn = Substitute.For<IProviderBurn>();
        providerBurn.TrailingWeek(Arg.Any<CancellationToken>()).Returns(new ProviderBurnOverTrailingWeek(
            new Dictionary<AIProviderId, long>(),
            new Dictionary<AIProviderId, int>()));

        _dispatcher = new AIProviderPoolDispatcher(
            [],
            providerBurn,
            Substitute.For<IAIProviderQuotaTracker>(),
            Substitute.For<Microsoft.Extensions.Logging.ILogger<AIProviderPoolDispatcher>>());
    }

    async Task Because() => _result = await _dispatcher.Complete(
        "prompt",
        [],
        new Dictionary<AIProviderId, ConfiguredAIProvider>(),
        new ModelName("gpt"),
        Effort.Medium);

    [Fact] void should_not_have_succeeded() => _result.Succeeded.ShouldBeFalse();
}
