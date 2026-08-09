// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Work.Callback.for_WorkerResults;

public class when_parsing_results : Specification
{
    [Fact]
    void should_find_the_last_pull_request_url()
    {
        var result = WorkerResults.TryFindPullRequest(
            "I looked at https://github.com/Cratis/Studio/pull/41 first.\nCreated https://github.com/Cratis/Studio/pull/42");
        result!.Number.ShouldEqual(new PullRequestNumber(42));
        result.Owner.ShouldEqual(new OrganizationName("Cratis"));
        result.Repository.ShouldEqual(new RepositoryName("Studio"));
    }

    [Fact]
    void should_find_nothing_when_no_pull_request_is_mentioned() =>
        WorkerResults.TryFindPullRequest("All done, no pull request needed").ShouldBeNull();

    [Fact]
    void should_find_the_suggested_model() =>
        WorkerResults.TryFindSuggestedModel("SUGGESTED-MODEL: sonnet\n\n## Plan\nDo the thing").ShouldEqual(new ModelName("sonnet"));

    [Fact]
    void should_find_nothing_when_no_model_is_suggested() =>
        WorkerResults.TryFindSuggestedModel("## Plan\nDo the thing").ShouldBeNull();
}
#endif
