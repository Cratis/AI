// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.Extensions.DependencyInjection;

namespace Planner.Alerts.AddingNote.when_adding_a_note;

public class and_text_is_given : Specification
{
    CommandScenario<AddAlertNote> _scenario;
    CommandResult _result;

    void Establish()
    {
        _scenario = new();
        var currentUser = Substitute.For<Planner.Identity.ICurrentUser>();
        currentUser.GetUserName().Returns(new UserName("einari"));
        _scenario.Services.AddSingleton(currentUser);
    }

    async Task Because() => _result = await _scenario.Execute(new AddAlertNote(
        "studio-production-pod-loki-0-crashloopbackoff",
        "The retention config never applied"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_record_the_note() => _scenario.EventSequence.ShouldHaveAppendedEvent<AlertNoteAdded>(
        @event => @event.Text == new AlertNote("The retention config never applied") && @event.Note != AlertNoteId.NotSet);
}
#endif
