// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using context = Planner.Work.Authorizing.for_WorkTokens.given.a_work_token_store;

namespace Planner.Work.Authorizing.for_WorkTokens.when_verifying_a_token;

public class and_nothing_was_presented : context
{
    bool _result;

    void Establish() => IssuedTokenIs("the-issued-token");

    async Task Because() => _result = await _workTokens.IsValid(_workId, WorkToken.NotSet);

    [Fact]
    void should_refuse_the_caller() => _result.ShouldBeFalse();

    [Fact]
    async Task should_not_look_the_work_up_at_all() =>
        await _readModels.DidNotReceive().GetInstanceById<WorkAuthorization>(Arg.Any<ReadModelKey>(), Arg.Any<ReadModelSessionId>());
}
#endif
