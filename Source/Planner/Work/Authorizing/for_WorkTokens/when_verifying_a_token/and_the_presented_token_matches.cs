// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using context = Planner.Work.Authorizing.for_WorkTokens.given.a_work_token_store;

namespace Planner.Work.Authorizing.for_WorkTokens.when_verifying_a_token;

public class and_the_presented_token_matches : context
{
    bool _result;

    void Establish() => IssuedTokenIs("the-issued-token");

    async Task Because() => _result = await _workTokens.IsValid(_workId, "the-issued-token");

    [Fact]
    void should_accept_the_caller() => _result.ShouldBeTrue();
}
#endif
