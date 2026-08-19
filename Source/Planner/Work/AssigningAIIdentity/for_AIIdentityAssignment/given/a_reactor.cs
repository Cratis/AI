// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Chronicle.Testing.Reactors;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Planner.GitHub;
using Planner.GitHub.App;
using Planner.Work.Listing;
using ListedIssue = Planner.Issues.Listing.Issue;

namespace Planner.Work.AssigningAIIdentity.for_AIIdentityAssignment.given;

public class a_reactor : Specification
{
    protected static readonly WorkId _workId = WorkId.New();

    protected IEventStore _eventStore;
    protected IGitHubClient _gitHub;
    protected GitHubAppOptions _options;

    protected ReactorScenario<AIIdentityAssignment> _scenario;

    void Establish()
    {
        _eventStore = Substitute.For<IEventStore>();
        _gitHub = Substitute.For<IGitHubClient>();
        _options = new();

        _scenario = new(new ServiceCollection()
            .AddSingleton(_eventStore)
            .AddSingleton(_gitHub)
            .AddSingleton<IOptions<GitHubAppOptions>>(Options.Create(_options))
            .BuildServiceProvider());
    }

    protected void SetWorkItem(WorkItem work) =>
        _eventStore.ReadModels.GetInstanceById<WorkItem>(Arg.Any<ReadModelKey>(), Arg.Any<ReadModelSessionId>())
            .Returns(work);

    protected void SetIssue(ListedIssue issue) =>
        _eventStore.ReadModels.GetInstanceById<ListedIssue>(Arg.Any<ReadModelKey>(), Arg.Any<ReadModelSessionId>())
            .Returns(issue);
}
#endif
