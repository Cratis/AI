// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues.Registration;

namespace Planner.Issues.Listing.for_Issue.when_projecting;

public class and_issue_is_registered : Specification
{
    static readonly IssueId _issueId = IssueId.From("Cratis", "Studio", 256);
    static readonly DateTimeOffset _createdAt = new(2026, 8, 1, 12, 0, 0, TimeSpan.Zero);

    ReadModelScenario<Issue> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_issueId)
            .Events(new IssueRegistered("Cratis", "Studio", 256, "Fix the thing", "Bug", "someuser", _createdAt, AuthorAssociation.External, true));

    [Fact] void should_hold_the_owner() => _scenario.Instance.Owner.ShouldEqual(new OrganizationName("Cratis"));
    [Fact] void should_hold_the_repository() => _scenario.Instance.Repository.ShouldEqual(new RepositoryName("Studio"));
    [Fact] void should_hold_the_number() => _scenario.Instance.Number.ShouldEqual(new IssueNumber(256));
    [Fact] void should_hold_the_title() => _scenario.Instance.Title.ShouldEqual(new IssueTitle("Fix the thing"));
    [Fact] void should_hold_the_author_association() => _scenario.Instance.AuthorAssociation.ShouldEqual(AuthorAssociation.External);
    [Fact] void should_be_open() => _scenario.Instance.IsOpen.ShouldBeTrue();
    [Fact] void should_have_no_status() => _scenario.Instance.Status.ShouldEqual(IssueStatus.None);
    [Fact] void should_not_be_grouped() => _scenario.Instance.Group.ShouldBeNull();
}
#endif
