// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using context = Planner.Work.Authorizing.for_WorkTokens.given.a_work_token_store;

namespace Planner.Work.Authorizing.for_WorkTokens.when_issuing_a_token;

public class and_work_is_dispatched : context
{
    WorkToken _first;
    WorkToken _second;

    async Task Because()
    {
        _first = await _workTokens.Issue(_workId);
        _second = await _workTokens.Issue(WorkId.New());
    }

    [Fact]
    void should_issue_a_token() => _first.Value.ShouldNotBeEmpty();

    [Fact]
    void should_issue_a_token_of_full_strength() =>
        _first.Value.Length.ShouldBeGreaterThan(WorkTokens.TokenByteCount);

    [Fact]
    void should_never_issue_the_same_token_twice() => _first.ShouldNotEqual(_second);

    [Fact]
    async Task should_record_the_token_against_the_work() =>
        await _eventLog.Received(1).Append(
            Arg.Is<EventSourceId>(id => id == (EventSourceId)_workId),
            Arg.Is<object>(@event => ((WorkTokenIssued)@event).Token == _first));
}
#endif
