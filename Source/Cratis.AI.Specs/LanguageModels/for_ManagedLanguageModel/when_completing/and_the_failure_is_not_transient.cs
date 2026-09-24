// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;
using NSubstitute;

namespace Cratis.AI.LanguageModels.for_ManagedLanguageModel.when_completing;

/// <summary>
/// A misconfiguration or a rejected request is never worth retrying - another attempt can never
/// change its outcome, so the first failure is final.
/// </summary>
public class and_the_failure_is_not_transient : given.an_inner_model
{
    LanguageModelResult _result;

    void Establish() => Inner.Complete(Arg.Any<string>(), Arg.Any<LanguageModelPurpose>(), Arg.Any<CancellationToken>())
        .Returns(LanguageModelResult.Failure("The provider rejected the request"));

    async Task Because() => _result = await Model.Complete("prompt", "triage");

    [Fact] void should_not_have_succeeded() => _result.Succeeded.ShouldBeFalse();

    [Fact]
    void should_have_attempted_the_completion_only_once() =>
        Inner.Received(1).Complete(Arg.Any<string>(), Arg.Any<LanguageModelPurpose>(), Arg.Any<CancellationToken>());

    [Fact]
    void should_not_have_waited_at_all() =>
        Delay.DidNotReceiveWithAnyArgs().Invoke(default, default);
}
