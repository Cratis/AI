// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Chronicle.Testing.Reactors;
using Microsoft.Extensions.DependencyInjection;
using Planner.LanguageModels;

namespace Planner.Builds.Analyzing.for_BuildFailureAnalysis.given;

public class a_reactor : Specification
{
    protected static readonly BuildWorkflowId _workflowId = BuildWorkflowId.From("Cratis", "Studio", "Update Packages");

    protected ICommandPipeline _commandPipeline;
    protected ILanguageModel _languageModel;

    protected ReactorScenario<BuildFailureAnalysis> _scenario;

    void Establish()
    {
        _commandPipeline = Substitute.For<ICommandPipeline>();
        _languageModel = Substitute.For<ILanguageModel>();

        _scenario = new(services => services
            .AddSingleton(_commandPipeline)
            .AddSingleton(_languageModel));
    }
}
#endif
