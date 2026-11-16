// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SigningIn.for_OpenAISubscriptionSignIns;

public class when_the_provider_is_no_longer_configured : given.a_sign_in
{
    void Establish() => _current = null;
    Task Because() => SignIn();

    [Fact] void should_preserve_the_recording_handlers_validation() => _events.Single().Event.ShouldBeOfExactType<OpenAISubscriptionSignInCompleted>();
}
