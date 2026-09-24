// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

/// <summary>
/// The caller's own cancellation is not the same thing as <see cref="AIProviderOptions.CompletionTimeout"/>
/// running out, and must still propagate rather than being swallowed into a transient
/// <see cref="LanguageModelResult"/> - an application shutting down, or a caller that genuinely no
/// longer wants the answer, needs to see that as a real cancellation.
/// </summary>
public class and_the_caller_cancels : given.all_dependencies
{
    static readonly AIProviderId _provider = AIProviderId.New();

    CancellationTokenSource _callerCancellation;
    Exception _error;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, _provider, null));
        ProviderIs(_provider, new(_provider, AIProviderType.Anthropic, "sk-ant-test"));

        _callerCancellation = new CancellationTokenSource();
        _anthropicClient.Complete(Arg.Any<string>(), Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>())
            .Returns(callInfo => AwaitCancellation(_callerCancellation, callInfo.Arg<CancellationToken>()));
    }

    async Task Because() =>
        _error = await Cratis.Specifications.Catch.Exception(() => _model.Complete("prompt", (LanguageModelPurpose)Purpose, _callerCancellation.Token));

    [Fact] void should_propagate_the_cancellation() => _error.ShouldBeOfExactType<TaskCanceledException>();

    static async Task<LanguageModelResult> AwaitCancellation(CancellationTokenSource callerCancellation, CancellationToken linkedToken)
    {
        // Cancels the caller's own token once the vendor client is actually called with the linked
        // one - the shape a caller that changed its mind mid-flight produces.
        await callerCancellation.CancelAsync();
        await Task.Delay(Timeout.Infinite, linkedToken);
        throw new InvalidOperationException("Should have been canceled before returning.");
    }
}
