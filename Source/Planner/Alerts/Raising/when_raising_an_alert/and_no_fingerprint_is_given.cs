// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Alerts.Raising.when_raising_an_alert;

public class and_no_fingerprint_is_given : Specification
{
    CommandScenario<RaiseAlert> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new RaiseAlert(
        "studio-production",
        "Something happened",
        "Something happened somewhere",
        AlertSeverity.Warning,
        AlertFingerprint.NotSet));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_have_validation_errors() => _result.ShouldHaveValidationErrors();
}
#endif
