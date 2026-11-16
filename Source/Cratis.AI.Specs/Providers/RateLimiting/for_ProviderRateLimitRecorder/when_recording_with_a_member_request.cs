// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.RateLimiting.for_ProviderRateLimitRecorder;

public class when_recording_with_a_member_request : given.internal_recording
{
    void Establish() => _request = _memberRequest;
    Task Because() => RecordAndCheckOutside();

    [Fact] void should_record_with_a_non_administrator_request() => _recorded.IsSuccess.ShouldBeTrue();
    [Fact] void should_clear_internal_execution() => _activeAfterRecording.ShouldBeFalse();
    [Fact] void should_deny_the_request_outside_the_scope() => _outside.IsAuthorized.ShouldBeFalse();
}
