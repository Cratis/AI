// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.RateLimiting.for_ProviderRateLimitRecorder;

public class when_recording_as_system : given.internal_recording
{
    Task Because() => RecordAndCheckOutside();

    [Fact] void should_record_without_an_http_request() => _recorded.IsSuccess.ShouldBeTrue();
    [Fact] void should_clear_internal_execution() => _activeAfterRecording.ShouldBeFalse();
    [Fact] void should_deny_execution_outside_the_scope() => _outside.IsAuthorized.ShouldBeFalse();
}
