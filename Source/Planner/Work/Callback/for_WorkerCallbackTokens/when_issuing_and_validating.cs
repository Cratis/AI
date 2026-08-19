// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Work.Callback.for_WorkerCallbackTokens;

public class when_issuing_and_validating : Specification
{
    static readonly WorkId _work = WorkId.New();
    static readonly DateTimeOffset _now = new(2026, 8, 8, 12, 0, 0, TimeSpan.Zero);

    TimeProvider _timeProvider;
    WorkerCallbackTokens _tokens;
    CallbackToken _issued;

    void Establish()
    {
        _timeProvider = Substitute.For<TimeProvider>();
        _timeProvider.GetUtcNow().Returns(_ => _now);
        _tokens = new(_timeProvider);
    }

    void Because() => _issued = _tokens.Issue(_work);

    [Fact] void should_validate_the_issued_token() => _tokens.Validate(_work, _issued.Value).ShouldBeTrue();
    [Fact] void should_not_validate_a_wrong_token() => _tokens.Validate(_work, "not-the-token").ShouldBeFalse();
    [Fact] void should_not_validate_a_missing_token() => _tokens.Validate(_work, null).ShouldBeFalse();
    [Fact] void should_not_validate_for_unknown_work() => _tokens.Validate(WorkId.New(), _issued.Value).ShouldBeFalse();

    [Fact]
    void should_not_validate_after_being_revoked()
    {
        _tokens.Revoke(_work);
        _tokens.Validate(_work, _issued.Value).ShouldBeFalse();
    }

    [Fact]
    void should_not_validate_an_expired_token()
    {
        _timeProvider.GetUtcNow().Returns(_ => _now + TimeSpan.FromHours(13));
        _tokens.Validate(_work, _issued.Value).ShouldBeFalse();
    }

    [Fact]
    void should_invalidate_the_previous_token_when_reissued()
    {
        var reissued = _tokens.Issue(_work);
        _tokens.Validate(_work, _issued.Value).ShouldBeFalse();
        _tokens.Validate(_work, reissued.Value).ShouldBeTrue();
    }
}
#endif
