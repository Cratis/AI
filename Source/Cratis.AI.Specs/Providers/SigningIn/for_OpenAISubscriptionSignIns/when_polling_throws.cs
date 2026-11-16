// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SigningIn.for_OpenAISubscriptionSignIns;

public class when_polling_throws : given.a_sign_in
{
    void Establish() => _pollingFails = true;
    Task Because() => SignIn();

    [Fact] void should_record_the_existing_failure_reason() => _events.Single().Event.ShouldEqual(new OpenAISubscriptionSignInFailed("The sign-in could not be completed. Start another one."));
    [Fact] void should_not_enter_internal_execution() => _internalDuringRecording.ShouldBeFalse();
}
