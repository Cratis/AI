// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using MongoDB.Driver;
using Planner.Issues.Grouping.Creating;
using Planner.Issues.Grouping.Deleting;

namespace Planner.Issues.Grouping.Listing;

/// <summary>
/// Read model for listing the issue groups.
/// </summary>
/// <param name="Id">The group identity.</param>
/// <param name="Name">The display name of the group.</param>
[ReadModel]
[FromEvent<GroupCreated>]
[RemovedWith<GroupDeleted>]
public record Group(GroupId Id, GroupName Name)
{
    /// <summary>
    /// Observes all groups.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the groups.</param>
    /// <returns>An observable of all groups.</returns>
    public static ISubject<IEnumerable<Group>> AllGroups(IMongoCollection<Group> collection) =>
        collection.Observe();
}
