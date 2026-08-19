// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Chronicle.Testing.Reactors;
using Microsoft.Extensions.DependencyInjection;
using Planner.LanguageModels;
using ListedRepository = Planner.Repositories.Listing.Repository;
using Cratis.Arc.Authorization;
using Planner.Identity;

namespace Planner.Issues.ClassifyingForAutoMerge.for_AutoMergeClassification.given;

public class a_reactor : Specification
{
    protected static readonly IssueId _issueId = IssueId.From("Cratis", "Studio", 256);

    protected IEventStore _eventStore;
    protected ICommandPipeline _commandPipeline;
    protected ILanguageModel _languageModel;

    protected ReactorScenario<AutoMergeClassification> _scenario;

    void Establish()
    {
        _eventStore = Substitute.For<IEventStore>();
        _commandPipeline = Substitute.For<ICommandPipeline>();
        _languageModel = Substitute.For<ILanguageModel>();

        _scenario = new(new ServiceCollection()
            .AddSingleton(_eventStore)
            .AddSingleton(_commandPipeline)
            .AddSingleton(_languageModel)
            .AddSingleton(SystemExecutionScope.ForSpecs())
            .BuildServiceProvider());
    }

    protected void SetRepository(ListedRepository repository) =>
        _eventStore.ReadModels.GetInstanceById<ListedRepository>(Arg.Any<ReadModelKey>(), Arg.Any<ReadModelSessionId>())
            .Returns(repository);

    protected void SetIssue(Listing.Issue issue) =>
        _eventStore.ReadModels.GetInstanceById<Listing.Issue>(Arg.Any<ReadModelKey>(), Arg.Any<ReadModelSessionId>())
            .Returns(issue);
}
#endif
