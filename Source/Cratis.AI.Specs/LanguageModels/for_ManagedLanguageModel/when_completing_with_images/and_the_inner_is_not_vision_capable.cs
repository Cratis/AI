// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using NSubstitute;

namespace Cratis.AI.LanguageModels.for_ManagedLanguageModel.when_completing_with_images;

/// <summary>
/// An inner model that only implements the text interface cannot take images - the completion fails
/// with a reason rather than dropping the images and answering from the prompt alone.
/// </summary>
public class and_the_inner_is_not_vision_capable : given.an_inner_model
{
    static readonly LanguageModelImage[] _images = [new(new byte[] { 1, 2, 3 }, "image/png")];
    LanguageModelResult _result;

    void Establish() => Model = CreateModel(Inner);

    async Task Because() => _result = await Model.Complete("prompt", _images, "triage");

    [Fact] void should_fail() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_say_it_cannot_take_images() => _result.FailureReason.ShouldContain("cannot take images");

    [Fact]
    void should_not_have_called_the_inner_model() =>
        Inner.DidNotReceive().Complete(Arg.Any<string>(), Arg.Any<LanguageModelPurpose>(), Arg.Any<CancellationToken>());
}
