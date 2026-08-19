// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using System.Security.Claims;
using Cratis.Arc.Authorization;
using Planner.GitHub;
using Planner.Identity;
using Planner.Repositories.Adding;
using Planner.Repositories.Organizations;
using Planner.Repositories.Organizations.Adding;

namespace Planner.Repositories.Discovery.for_RepositoryDiscovery.when_organization_is_added;

/// <summary>
/// Proves the reactor's <c>AsSystem()</c> scope is actually entered around the commands it executes,
/// by observing the ambient principal from inside the command pipeline itself.
/// </summary>
/// <remarks>
/// This closes a real blind spot rather than adding coverage for its own sake. Every other reactor
/// spec substitutes <see cref="ICommandPipeline"/>, which records the call and returns success without
/// ever consulting authorization - so deleting a reactor's
/// <c>using var scope = systemExecution.AsSystem()</c> leaves all of them green while the reactor is,
/// in production, denied at runtime by <c>DenyByDefaultAuthorization</c>. Confirmed by experiment:
/// removing the scope from <see cref="RepositoryDiscovery"/> failed nothing at all.
/// <para>
/// Rather than stand up the real command pipeline - ten constructor dependencies, and a spec that
/// would mostly be testing its own wiring - this reads the principal Arc itself would read, at the
/// moment the reactor executes its command. Without the scope there is no authenticated principal
/// there, and the assertion fails.
/// </para>
/// </remarks>
public class and_it_executes_commands : given.a_reactor
{
    ClaimsPrincipal? _principalDuringExecution;

    void Establish()
    {
        var principalAccessor = new CurrentPrincipalAccessor(SystemExecutionScope.NoRequestContextAccessor());

        _commandPipeline
            .Execute(Arg.Any<AddRepository>())
            .Returns(_ =>
            {
                _principalDuringExecution = principalAccessor.Current;
                return new CommandResult();
            });

        _gitHub.GetOrganizationRepositories(new OrganizationName("Cratis"), Arg.Any<CancellationToken>())
            .Returns([new GitHubRepository("Cratis", "Studio", true)]);
    }

    async Task Because() =>
        await _scenario.Given.ForEventSource(OrganizationId.From("Cratis")).Events(new OrganizationAdded("Cratis", OrganizationTrackingPolicy.All));

    [Fact]
    void should_execute_the_command_as_an_authenticated_actor() =>
        (_principalDuringExecution?.Identity?.IsAuthenticated == true).ShouldBeTrue();
}
#endif
