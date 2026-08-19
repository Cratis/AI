// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Chronicle.Testing.Reactors;
using Microsoft.Extensions.DependencyInjection;
using Planner.GitHub;
using Planner.LanguageModels;
using ListedIssue = Planner.Issues.Listing.Issue;
using Cratis.Arc.Authorization;
using Planner.Identity;

namespace Planner.Roadmap.GeneratingPlan.for_PlanGeneration.given;

public class a_reactor : Specification
{
    protected static readonly PlanId _planId = PlanId.New();

    protected IEventStore _eventStore;
    protected ICommandPipeline _commandPipeline;
    protected ILanguageModel _languageModel;
    protected IGitHubClient _gitHub;

    protected ReactorScenario<PlanGeneration> _scenario;

    void Establish()
    {
        _eventStore = Substitute.For<IEventStore>();
        _commandPipeline = Substitute.For<ICommandPipeline>();
        _languageModel = Substitute.For<ILanguageModel>();
        _gitHub = Substitute.For<IGitHubClient>();

        _scenario = new(new ServiceCollection()
            .AddSingleton(_eventStore)
            .AddSingleton(_commandPipeline)
            .AddSingleton(_languageModel)
            .AddSingleton(_gitHub)
            .AddSingleton(SystemExecutionScope.ForSpecs())
            .BuildServiceProvider());
    }

    protected void SetIssue(ListedIssue issue) =>
        _eventStore.ReadModels.GetInstanceById<ListedIssue>(Arg.Any<ReadModelKey>(), Arg.Any<ReadModelSessionId>())
            .Returns(issue);
}
#endif
