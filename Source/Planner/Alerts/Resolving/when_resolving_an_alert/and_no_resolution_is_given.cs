// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Alerts.Resolving.when_resolving_an_alert;

public class and_no_resolution_is_given : Specification
{
    CommandScenario<ResolveAlert> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new ResolveAlert(
        "studio-production-pod-loki-0-crashloopbackoff",
        AlertNote.NotSet));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_have_validation_errors() => _result.ShouldHaveValidationErrors();
}
#endif
