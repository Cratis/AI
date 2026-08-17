// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using context = Planner.Work.Authorizing.for_WorkTokens.given.a_work_token_store;

namespace Planner.Work.Authorizing.for_WorkTokens.when_verifying_a_token;

/// <summary>
/// The read model resolves to nothing at all for work that was never dispatched, and to a default
/// instance once a terminal event retired its token. Both have to refuse.
/// </summary>
public class and_no_token_was_ever_issued : context
{
    bool _nothingIssued;
    bool _tokenRetired;

    async Task Because()
    {
        _nothingIssued = await _workTokens.IsValid(_workId, "any-token-at-all");
        IssuedTokenIs(WorkToken.NotSet);
        _tokenRetired = await _workTokens.IsValid(_workId, "any-token-at-all");
    }

    [Fact]
    void should_refuse_a_caller_for_undispatched_work() => _nothingIssued.ShouldBeFalse();

    [Fact]
    void should_refuse_a_caller_once_the_token_is_retired() => _tokenRetired.ShouldBeFalse();
}
#endif
