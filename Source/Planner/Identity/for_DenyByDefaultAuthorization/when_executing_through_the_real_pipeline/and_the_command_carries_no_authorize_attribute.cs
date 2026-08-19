// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Repositories.Adding;

namespace Planner.Identity.for_DenyByDefaultAuthorization.when_executing_through_the_real_pipeline;

public class and_the_command_carries_no_authorize_attribute : Specification
{
    CommandScenario<AddRepository> _scenario;
    CommandResult _result;

    void Establish()
    {
        _scenario = new();

        // CommandScenarioDefaultCaller establishes an authenticated caller for every scenario by
        // default - this spec means to prove genuine denial, so it overrides that back to no request,
        // no principal at all, the same as an anonymous request to /api. A later registration for the
        // same service type wins.
        _scenario.Services.AddSingleton(CommandScenarioDefaultCaller.NoRequestContext());
    }

    // AddRepository carries no [Authorize] of its own, which is exactly the surface this evaluator
    // exists to close.
    async Task Because() => _result = await _scenario.Execute(new AddRepository("cratis", "planner"));

    [Fact] void should_not_be_authorized() => _result.ShouldNotBeAuthorized();
}
#endif
