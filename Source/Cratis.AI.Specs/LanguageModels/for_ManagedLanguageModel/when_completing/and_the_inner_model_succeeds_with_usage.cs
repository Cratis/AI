// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;
using Cratis.AI.Usage;
using NSubstitute;

namespace Cratis.AI.LanguageModels.for_ManagedLanguageModel.when_completing;

/// <summary>
/// A successful completion that reported usage gets it recorded through
/// <see cref="RecordAgentSessionUsage"/> - the one command every completion's usage flows through,
/// whether it came from a harness session or a direct completion like this one.
/// </summary>
public class and_the_inner_model_succeeds_with_usage : given.an_inner_model
{
    LanguageModelResult _result;

    void Establish() => Inner.Complete(Arg.Any<string>(), Arg.Any<LanguageModelPurpose>(), Arg.Any<CancellationToken>())
        .Returns(LanguageModelResult.Success(
            "the answer",
            new LanguageModelUsage(new InputTokens(100), new OutputTokens(20)),
            new Common.ModelName("sonnet")));

    async Task Because() => _result = await Model.Complete("prompt", "triage");

    [Fact] void should_succeed() => _result.Succeeded.ShouldBeTrue();

    [Fact]
    void should_have_recorded_usage() =>
        CommandPipeline.Received(1).Execute(Arg.Is<RecordAgentSessionUsage>(command =>
            command.InputTokens == new InputTokens(100) &&
            command.OutputTokens == new OutputTokens(20)));
}
