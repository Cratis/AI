// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Chronicle.Testing.Reactors;
using Microsoft.Extensions.DependencyInjection;
using Planner.GitHub;
using Planner.Repositories.Adding;
using Planner.Repositories.Organizations.Adding;

namespace Planner.Repositories.Discovery.for_RepositoryDiscovery;

public class when_organization_is_added : Specification
{
    IGitHubClient _gitHub;
    ICommandPipeline _commandPipeline;
    ReactorScenario<RepositoryDiscovery> _scenario;

    void Establish()
    {
        _gitHub = Substitute.For<IGitHubClient>();
        _commandPipeline = Substitute.For<ICommandPipeline>();
        _gitHub.GetOrganizationRepositories(new OrganizationName("Cratis"), Arg.Any<CancellationToken>())
            .Returns(
            [
                new GitHubRepository("Cratis", "Studio", true),
                new GitHubRepository("Cratis", "Chronicle", false)
            ]);

        _scenario = new(new ServiceCollection()
            .AddSingleton(_gitHub)
            .AddSingleton(_commandPipeline)
            .BuildServiceProvider());
    }

    async Task Because() =>
        await _scenario.Given.ForEventSource(OrganizationId.From("Cratis")).Events(new OrganizationAdded("Cratis"));

    [Fact]
    async Task should_add_the_first_repository() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<AddRepository>(command => command.Name == new RepositoryName("Studio")));

    [Fact]
    async Task should_add_the_second_repository() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<AddRepository>(command => command.Name == new RepositoryName("Chronicle")));
}
#endif
