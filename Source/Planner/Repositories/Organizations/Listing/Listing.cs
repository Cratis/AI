// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using MongoDB.Driver;
using Planner.Repositories.Discovery;
using Planner.Repositories.Organizations.Adding;

namespace Planner.Repositories.Organizations.Listing;

/// <summary>
/// Read model for listing the organizations the Planner tracks, together with how discovering their
/// repositories went - an organization whose repositories could never be looked up has to say so
/// rather than sit in the list looking like every other one.
/// </summary>
/// <param name="Id">The organization identity.</param>
/// <param name="Name">The name of the organization.</param>
/// <param name="DiscoveryStatus">How far repository discovery got.</param>
/// <param name="TrackingPolicy">Whether every repository is tracked automatically, or only ones explicitly selected.</param>
/// <param name="DiscoveredRepositories">The names of every repository discovery found - the pool a "Selected" organization picks from.</param>
/// <param name="DiscoveryFailure">Why discovery failed - empty unless <see cref="DiscoveryStatus"/> is <see cref="RepositoryDiscoveryStatus.Failed"/>.</param>
[ReadModel]
[FromEvent<OrganizationAdded>]
public record Organization(
    OrganizationId Id,
    OrganizationName Name,
    [SetValue<OrganizationAdded>(RepositoryDiscoveryStatus.Pending)]
    [SetValue<OrganizationRepositoriesDiscovered>(RepositoryDiscoveryStatus.Discovered)]
    [SetValue<OrganizationRepositoryDiscoveryFailed>(RepositoryDiscoveryStatus.Failed)]
    RepositoryDiscoveryStatus DiscoveryStatus,
    [SetFrom<OrganizationAdded>(nameof(OrganizationAdded.TrackingPolicy))]
    OrganizationTrackingPolicy TrackingPolicy,
    [SetFrom<OrganizationRepositoriesDiscovered>(nameof(OrganizationRepositoriesDiscovered.RepositoryNames))]
    IEnumerable<string>? DiscoveredRepositories = null,
    [SetValue<OrganizationAdded>("")]
    [SetValue<OrganizationRepositoriesDiscovered>("")]
    [SetFrom<OrganizationRepositoryDiscoveryFailed>(nameof(OrganizationRepositoryDiscoveryFailed.Reason))]
    string DiscoveryFailure = "")
{
    /// <summary>
    /// The number of repositories discovery found - <c>0</c> until it succeeds.
    /// </summary>
    public int RepositoryCount => (DiscoveredRepositories ?? []).Count();

    /// <summary>
    /// Observes all organizations.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the organizations.</param>
    /// <returns>An observable of all organizations.</returns>
    public static ISubject<IEnumerable<Organization>> AllOrganizations(IMongoCollection<Organization> collection) =>
        collection.Observe();
}
