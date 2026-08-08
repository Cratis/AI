// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Issues.Registration.when_registering_issue;

public class and_information_is_valid : Specification
{
    static readonly DateTimeOffset _createdAt = new(2026, 8, 1, 12, 0, 0, TimeSpan.Zero);

    CommandScenario<RegisterIssue> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(
        new RegisterIssue("Cratis", "Studio", 256, "Fix the thing", "Bug", "someuser", _createdAt, AuthorAssociation.Member, true));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    async Task should_append_issue_registered_with_the_predictable_key() =>
        await _scenario.EventSequence.ShouldHaveAppendedEvent<IssueRegistered>(
            "cratis-studio-256",
            @event =>
                @event.Owner == new OrganizationName("Cratis") &&
                @event.Repository == new RepositoryName("Studio") &&
                @event.Number == new IssueNumber(256) &&
                @event.Title == new IssueTitle("Fix the thing") &&
                @event.CreatedAt == _createdAt &&
                @event.IsOpen);
}
#endif
