// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Copilot.for_CopilotSignIns;

public class when_a_sign_in_is_refused : given.a_sign_in
{
    void Establish() => _result = new(null, false, false, "Access was declined.");
    Task Because() => SignIn();

    [Fact] void should_record_the_refusal_reason() => _events.Single().Event.ShouldEqual(new CopilotSignInFailed("Access was declined."));
}
