// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using NSubstitute;

namespace Cratis.AI.LanguageModels.for_ManagedLanguageModel.when_completing_with_images;

/// <summary>
/// An image completion that reported usage is metered under the purpose exactly like a text one.
/// </summary>
public class and_the_inner_model_succeeds_with_usage : given.an_inner_model
{
    static readonly LanguageModelImage[] _images = [new(new byte[] { 1, 2, 3 }, "image/png")];
    LanguageModelResult _result;

    void Establish()
    {
        VisionInner.Complete(Arg.Any<string>(), Arg.Any<IReadOnlyList<LanguageModelImage>>(), Arg.Any<LanguageModelPurpose>(), Arg.Any<CancellationToken>())
            .Returns(LanguageModelResult.Success(
                "the answer",
                new LanguageModelUsage(new InputTokens(100), new OutputTokens(20)),
                new Common.ModelName("sonnet")));
        Model = CreateModel((ILanguageModel)VisionInner);
    }

    async Task Because() => _result = await Model.Complete("prompt", _images, "triage");

    [Fact] void should_succeed() => _result.Succeeded.ShouldBeTrue();

    [Fact]
    void should_have_passed_the_images_on() =>
        VisionInner.Received(1).Complete("prompt", _images, Arg.Any<LanguageModelPurpose>(), Arg.Any<CancellationToken>());

    [Fact]
    void should_have_recorded_usage_under_the_purpose() =>
        CommandPipeline.Received(1).Execute(Arg.Is<RecordAgentSessionUsage>(command =>
            command.Purpose == "triage" &&
            command.InputTokens == new InputTokens(100) &&
            command.OutputTokens == new OutputTokens(20)));
}
