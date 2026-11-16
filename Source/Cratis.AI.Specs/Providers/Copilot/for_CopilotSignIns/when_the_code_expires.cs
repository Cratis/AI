// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Copilot.for_CopilotSignIns;

public class when_the_code_expires : given.a_sign_in
{
    void Establish() => _authorization = _authorization with { ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(-1) };
    Task Because() => SignIn();

    [Fact] void should_record_the_existing_expiry_reason() => _events.Single().Event.ShouldEqual(new CopilotSignInFailed("Nobody authorized the sign-in before the code expired. Start another one."));
    [Fact] void should_not_attempt_to_exchange_an_expired_code() => _tokens.DidNotReceive().Complete(Arg.Any<CopilotDeviceAuthorization>(), Arg.Any<CancellationToken>());
}
