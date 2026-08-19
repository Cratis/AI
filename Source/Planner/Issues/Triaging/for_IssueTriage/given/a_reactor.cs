// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Chronicle.Testing.Reactors;
using Microsoft.Extensions.DependencyInjection;
using Planner.GitHub;
using Planner.LanguageModels;

namespace Planner.Issues.Triaging.for_IssueTriage.given;

public class a_reactor : Specification
{
    protected static readonly IssueId _issueId = IssueId.From("Cratis", "Studio", 256);

    protected IGitHubClient _gitHub;
    protected ICommandPipeline _commandPipeline;
    protected ILanguageModel _languageModel;

    protected ReactorScenario<IssueTriage> _scenario;

    void Establish()
    {
        _gitHub = Substitute.For<IGitHubClient>();
        _commandPipeline = Substitute.For<ICommandPipeline>();
        _languageModel = Substitute.For<ILanguageModel>();

        _scenario = new(services => services
            .AddSingleton(_gitHub)
            .AddSingleton(_commandPipeline)
            .AddSingleton(_languageModel));
    }
}
#endif
