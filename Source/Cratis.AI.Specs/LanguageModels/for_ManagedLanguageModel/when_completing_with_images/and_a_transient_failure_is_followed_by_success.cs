// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using NSubstitute;

namespace Cratis.AI.LanguageModels.for_ManagedLanguageModel.when_completing_with_images;

/// <summary>
/// An image completion shares the text completion's retry of a transient failure.
/// </summary>
public class and_a_transient_failure_is_followed_by_success : given.an_inner_model
{
    static readonly LanguageModelImage[] _images = [new(new byte[] { 1, 2, 3 }, "image/png")];
    LanguageModelResult _result;

    void Establish()
    {
        VisionInner.Complete(Arg.Any<string>(), Arg.Any<IReadOnlyList<LanguageModelImage>>(), Arg.Any<LanguageModelPurpose>(), Arg.Any<CancellationToken>())
            .Returns(
                LanguageModelResult.TransientFailure("The language model API returned 503"),
                LanguageModelResult.Success("the answer"));
        Model = CreateModel((ILanguageModel)VisionInner);
    }

    async Task Because() => _result = await Model.Complete("prompt", _images, "triage");

    [Fact] void should_return_the_successful_retry() => _result.Succeeded.ShouldBeTrue();

    [Fact]
    void should_have_attempted_the_completion_twice() =>
        VisionInner.Received(2).Complete(Arg.Any<string>(), Arg.Any<IReadOnlyList<LanguageModelImage>>(), Arg.Any<LanguageModelPurpose>(), Arg.Any<CancellationToken>());

    [Fact]
    void should_have_waited_the_default_backoff_before_retrying() =>
        Delay.Received(1).Invoke(TimeSpan.FromSeconds(2), Arg.Any<CancellationToken>());
}
