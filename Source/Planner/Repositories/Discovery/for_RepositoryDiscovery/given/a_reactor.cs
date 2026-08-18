// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Arc.Authorization;
using Cratis.Chronicle.Testing.Reactors;
using Planner.GitHub;

namespace Planner.Repositories.Discovery.for_RepositoryDiscovery.given;

public class a_reactor : Specification
{
    protected IGitHubClient _gitHub;
    protected ICommandPipeline _commandPipeline;
    protected ISystemExecution _systemExecution;
    protected ReactorScenario<RepositoryDiscovery> _scenario;

    void Establish()
    {
        _gitHub = Substitute.For<IGitHubClient>();
        _commandPipeline = Substitute.For<ICommandPipeline>();
        _systemExecution = Substitute.For<ISystemExecution>();

        _scenario = new(services => services
            .AddSingleton(_gitHub)
            .AddSingleton(_commandPipeline)
            .AddSingleton(_systemExecution));
    }
}
#endif
