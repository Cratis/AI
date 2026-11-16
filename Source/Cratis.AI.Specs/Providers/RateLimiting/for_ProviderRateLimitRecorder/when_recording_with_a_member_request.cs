// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;

namespace Cratis.AI.Providers.RateLimiting.for_ProviderRateLimitRecorder;

public class when_recording_with_a_member_request : given.internal_recording
{
    void Establish() => _request = _memberRequest;
    Task Because() => RecordAndCheckOutside();

    [Fact] void should_execute_under_the_request_tenant() => _pipelineTenant.ShouldEqual(_tenant);
    [Fact] void should_preserve_the_tenant_after_recording() => _tenantAfterRecording.ShouldEqual(_tenant);
    [Fact] void should_record_with_a_non_administrator_request() => _recorded.IsSuccess.ShouldBeTrue();
    [Fact] void should_clear_internal_execution() => _activeAfterRecording.ShouldBeFalse();
    [Fact] void should_deny_the_request_outside_the_scope() => _outside.IsAuthorized.ShouldBeFalse();
    [Fact] void should_restore_the_request_context() => _requestAfterRecording.ShouldBeSame(_request);
    [Fact] void should_preserve_the_request_principal() => _request!.User.ShouldBeSame(_originalPrincipal);
    [Fact] void should_restore_the_current_principal() => _principalAfterRecording.ShouldBeSame(_originalPrincipal);
    [Fact] void should_use_an_authenticated_principal_for_recording() => _recordingPrincipal!.Identity!.IsAuthenticated.ShouldBeTrue();
    [Fact] void should_use_the_system_principal_for_recording() => _recordingPrincipal!.Identity!.AuthenticationType.ShouldEqual(SystemPrincipal.AuthenticationType);
    [Fact] void should_leave_the_request_principal_unchanged_during_recording() => _requestPrincipalDuringRecording.ShouldBeSame(_originalPrincipal);
}
