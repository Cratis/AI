// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;
using NSubstitute;

namespace Cratis.AI.LanguageModels.for_ManagedLanguageModel.when_completing;

/// <summary>
/// A vendor rate limit or server error is worth another attempt at - the second one, moments later,
/// commonly finds the vendor recovered.
/// </summary>
public class and_a_transient_failure_is_followed_by_success : given.an_inner_model
{
    LanguageModelResult _result;

    void Establish() => Inner.Complete(Arg.Any<string>(), Arg.Any<LanguageModelPurpose>(), Arg.Any<CancellationToken>())
        .Returns(
            LanguageModelResult.TransientFailure("The language model API returned 503"),
            LanguageModelResult.Success("the answer"));

    async Task Because() => _result = await Model.Complete("prompt", "triage");

    [Fact] void should_return_the_successful_retry() => _result.Succeeded.ShouldBeTrue();
    [Fact] void should_return_the_retrys_text() => _result.Text.ShouldEqual("the answer");

    [Fact]
    void should_have_attempted_the_completion_twice() =>
        Inner.Received(2).Complete(Arg.Any<string>(), Arg.Any<LanguageModelPurpose>(), Arg.Any<CancellationToken>());

    [Fact]
    void should_have_waited_the_default_backoff_before_retrying() =>
        Delay.Received(1).Invoke(TimeSpan.FromSeconds(2), Arg.Any<CancellationToken>());
}
