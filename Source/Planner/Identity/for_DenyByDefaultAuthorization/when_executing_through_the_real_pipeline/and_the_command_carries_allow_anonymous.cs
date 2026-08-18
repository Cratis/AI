// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Identity.for_DenyByDefaultAuthorization.when_executing_through_the_real_pipeline.given;

namespace Planner.Identity.for_DenyByDefaultAuthorization.when_executing_through_the_real_pipeline;

public class and_the_command_carries_allow_anonymous : Specification
{
    CommandScenario<AnonymousTestCommand> _scenario;
    CommandResult _result;

    void Establish()
    {
        _scenario = new();

        // Overrides CommandScenarioDefaultCaller's own default principal - this spec means to prove
        // [AllowAnonymous] genuinely allows a caller with no principal at all, not one that happens to
        // succeed because a default caller was standing in.
        _scenario.Services.AddSingleton(CommandScenarioDefaultCaller.NoRequestContext());
    }

    // No principal, no system-execution scope - genuinely anonymous, the same as an unauthenticated
    // request to /api. [AllowAnonymous] is checked before any IAuthorizationAttributeEvaluator runs
    // (see Cratis.Arc.Authorization.AuthorizationEvaluator), so DenyByDefaultAuthorization never gets
    // a say for this command.
    async Task Because() => _result = await _scenario.Execute(new AnonymousTestCommand());

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] void should_append_the_event() => _scenario.EventSequence.ShouldHaveAppendedEvent<AnonymousTestCommandAccepted>();
}
#endif
