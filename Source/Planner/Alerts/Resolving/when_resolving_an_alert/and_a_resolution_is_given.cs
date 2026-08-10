// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.Extensions.DependencyInjection;

namespace Planner.Alerts.Resolving.when_resolving_an_alert;

public class and_a_resolution_is_given : Specification
{
    CommandScenario<ResolveAlert> _scenario;
    CommandResult _result;

    void Establish()
    {
        _scenario = new();
        var currentUser = Substitute.For<Planner.Identity.ICurrentUser>();
        currentUser.GetUserName().Returns(new UserName("einari"));
        _scenario.Services.AddSingleton(currentUser);
    }

    async Task Because() => _result = await _scenario.Execute(new ResolveAlert(
        "studio-production-pod-loki-0-crashloopbackoff",
        "Resized the volume to 40Gi"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_alert_resolved() => _scenario.EventSequence.ShouldHaveAppendedEvent<AlertResolved>(
        @event => @event.Resolution == new AlertNote("Resized the volume to 40Gi"));
}
#endif
