// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

/// <summary>
/// A vendor that stops responding without ever erroring must degrade into an ordinary transient
/// failure once <see cref="AIProviderOptions.CompletionTimeout"/> runs out - never into an uncaught
/// <see cref="OperationCanceledException"/> reaching whichever reactor or job asked for the
/// completion. The deadline is what cancels the token the provider client is called with, so the
/// vendor client here behaves exactly like a real one that honors cancellation: it awaits
/// indefinitely until its token fires.
/// </summary>
public class and_the_completion_deadline_expires : given.all_dependencies
{
    static readonly AIProviderId _provider = AIProviderId.New();

    ProviderAwareLanguageModel _shortDeadlineModel;
    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, _provider, null));
        ProviderIs(_provider, new(_provider, AIProviderType.Anthropic, "sk-ant-test"));

        _anthropicClient.Complete(Arg.Any<string>(), Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>())
            .Returns(callInfo => AwaitCancellation(callInfo.Arg<CancellationToken>()));

        // A deadline of a few milliseconds, not the 45-second production default, so the spec is fast
        // and deterministic rather than a real timer race.
        _shortDeadlineModel = new(
            new Cratis.Types.KnownInstancesOf<IAIProviderClient>(_anthropicClient, _openAIClient),
            _compatibility,
            _readModels,
            new Pools.ProviderBurn(_sessions, TimeProvider.System),
            _providerUsageLevels,
            _recentProviderFailures,
            _providerGate,
            new DefaultAgentInvocationModes(),
            _commandPipeline,
            _timeProvider,
            Options.Create(new AIProviderOptions { CompletionTimeout = TimeSpan.FromMilliseconds(20) }),
            _logger);
    }

    async Task Because() => _result = await _shortDeadlineModel.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_not_succeed() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_be_transient() => _result.IsTransient.ShouldBeTrue();
    [Fact] void should_say_it_did_not_finish_in_time() => _result.FailureReason.ShouldContain("did not finish");

    static async Task<LanguageModelResult> AwaitCancellation(CancellationToken cancellationToken)
    {
        await Task.Delay(Timeout.Infinite, cancellationToken);
        throw new InvalidOperationException("Should have been canceled before returning.");
    }
}
