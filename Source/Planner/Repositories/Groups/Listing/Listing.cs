// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using MongoDB.Driver;
using Planner.Repositories.Groups.Changing;
using Planner.Repositories.Groups.Creating;
using Planner.Repositories.Groups.Deleting;

namespace Planner.Repositories.Groups.Listing;

/// <summary>
/// Read model for listing the named repository groups.
/// </summary>
/// <param name="Id">The group identity.</param>
/// <param name="Name">The display name of the group.</param>
/// <param name="Repositories">The identities of the repositories in the group.</param>
[ReadModel]
[FromEvent<RepositoryGroupCreated>]
[FromEvent<RepositoryGroupMembersChanged>]
[RemovedWith<RepositoryGroupDeleted>]
public record RepositoryGroup(
    RepositoryGroupId Id,
    RepositoryGroupName Name,
    IEnumerable<RepositoryId> Repositories)
{
    /// <summary>
    /// Observes all repository groups.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the groups.</param>
    /// <returns>An observable of all repository groups.</returns>
    public static ISubject<IEnumerable<RepositoryGroup>> AllRepositoryGroups(IMongoCollection<RepositoryGroup> collection) =>
        collection.Observe();
}
