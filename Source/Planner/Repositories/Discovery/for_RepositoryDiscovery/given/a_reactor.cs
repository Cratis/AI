// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Chronicle.Testing.Reactors;
using Planner.GitHub;
using Planner.Identity;

namespace Planner.Repositories.Discovery.for_RepositoryDiscovery.given;

public class a_reactor : Specification
{
    protected IGitHubClient _gitHub;
    protected ICommandPipeline _commandPipeline;
    protected ReactorScenario<RepositoryDiscovery> _scenario;

    void Establish()
    {
        _gitHub = Substitute.For<IGitHubClient>();
        _commandPipeline = Substitute.For<ICommandPipeline>();

        _scenario = new(services => services
            .AddSingleton(_gitHub)
            .AddSingleton(_commandPipeline)
            .AddSingleton(SystemExecutionScope.ForSpecs()));
    }
}
#endif
