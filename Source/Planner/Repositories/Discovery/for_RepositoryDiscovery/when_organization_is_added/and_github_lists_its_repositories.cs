// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.GitHub;
using Planner.Repositories.Adding;
using Planner.Repositories.Organizations.Adding;

namespace Planner.Repositories.Discovery.for_RepositoryDiscovery.when_organization_is_added;

public class and_github_lists_its_repositories : given.a_reactor
{
    void Establish() =>
        _gitHub.GetOrganizationRepositories(new OrganizationName("Cratis"), Arg.Any<CancellationToken>())
            .Returns(
            [
                new GitHubRepository("Cratis", "Studio", true),
                new GitHubRepository("Cratis", "Chronicle", false)
            ]);

    async Task Because() =>
        await _scenario.Given.ForEventSource(OrganizationId.From("Cratis")).Events(new OrganizationAdded("Cratis"));

    [Fact]
    async Task should_add_the_first_repository() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<AddRepository>(command => command.Name == new RepositoryName("Studio")));

    [Fact]
    async Task should_add_the_second_repository() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<AddRepository>(command => command.Name == new RepositoryName("Chronicle")));

    [Fact]
    void should_record_how_many_repositories_were_found() =>
        _scenario.ShouldHaveProduced<OrganizationRepositoriesDiscovered>(@event => @event.RepositoryCount == 2);

    [Fact]
    void should_not_record_a_failure() => _scenario.ShouldNotHaveProduced<OrganizationRepositoryDiscoveryFailed>();

    // A reactor has no HTTP request behind it - proves adding the discovered repositories runs
    // inside the trusted system scope rather than relying on (nonexistent) ambient authorization.
    [Fact] void should_discover_as_the_system() => _systemExecution.Received(1).AsSystem();
}
#endif
