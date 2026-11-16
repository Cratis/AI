// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Copilot.for_CopilotSignIns;

public class when_recording_a_refusal_throws : given.a_sign_in
{
    void Establish()
    {
        _result = new(null, false, false, "Access was declined.");
        _throwOnFirstFailure = true;
    }

    Task Because() => SignIn();

    [Fact] void should_retry_recording_the_failure() => _failureAttempts.ShouldEqual(2);
    [Fact] void should_record_the_existing_fallback_reason() => _events.Single().Event.ShouldEqual(new CopilotSignInFailed("The sign-in could not be completed. Start another one."));
    [Fact] void should_not_enter_internal_execution() => _internalDuringRecording.ShouldBeFalse();
}
