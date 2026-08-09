// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues.ChangingBody;
using Planner.Issues.ChangingLabels;
using Planner.Issues.Comments.Recording;
using Planner.Issues.Comments.Removing;
using Planner.Issues.Registration;
using Planner.Issues.SettingPrompt;

namespace Planner.Issues.Listing.for_Issue.when_projecting;

public class and_comments_are_added_and_removed : Specification
{
    static readonly IssueId _issueId = IssueId.From("Cratis", "Studio", 256);

    ReadModelScenario<Issue> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_issueId)
            .Events(
                new IssueRegistered("Cratis", "Studio", 256, "Fix the thing", "Bug", "someuser", DateTimeOffset.UnixEpoch, AuthorAssociation.Member, true, "It is broken", [new LabelName("bug")]),
                new IssueBodyChanged("It is quite broken"),
                new IssueLabelsChanged([new LabelName("bug"), new LabelName("urgent")]),
                new IssuePromptSet("Be careful with the storage layer"),
                new IssueCommentAdded(1001, "someuser", "More detail", new DateTimeOffset(2026, 8, 2, 8, 0, 0, TimeSpan.Zero)),
                new IssueCommentAdded(1002, "another", "A wrong lead", new DateTimeOffset(2026, 8, 2, 9, 0, 0, TimeSpan.Zero)),
                new IssueCommentRemoved(1002));

    [Fact] void should_hold_the_changed_body() => _scenario.Instance.Body.ShouldEqual(new IssueBody("It is quite broken"));
    [Fact] void should_hold_both_labels() => _scenario.Instance.Labels!.Count().ShouldEqual(2);
    [Fact] void should_hold_the_prompt() => _scenario.Instance.Prompt.ShouldEqual(new WorkPrompt("Be careful with the storage layer"));
    [Fact] void should_hold_the_remaining_comment() => _scenario.Instance.Comments!.Single().Id.ShouldEqual(new CommentId(1001));
    [Fact] void should_hold_the_comment_author() => _scenario.Instance.Comments!.Single().Author.ShouldEqual(new UserName("someuser"));
}
#endif
