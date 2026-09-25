// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace Cratis.AI.Decisions.for_Decisions.when_deciding;

/// <summary>
/// Nothing was consumed that a person could be billed for, so nothing is recorded - usage records
/// answers, and a failed call is the telemetry's to report.
/// </summary>
public class and_the_engine_cannot_be_reached : given.all_dependencies
{
    Exception _result;

    void Establish() => _client
        .Decide(Arg.Any<IReadOnlyList<DecisionRequest>>(), Arg.Any<DecisionEngineConnection>(), Arg.Any<CancellationToken>())
        .ThrowsAsync(new HttpRequestException("unreachable"));

    async Task Because() => _result = await Catch.Exception(() => _decisions.Decide(RequestFor("bug", "feature")));

    [Fact] void should_let_the_failure_through() => _result.ShouldBeOfExactType<HttpRequestException>();
    [Fact] void should_not_record_any_usage() => _usage.ReceivedCalls().ShouldBeEmpty();
}
