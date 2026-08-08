// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using MongoDB.Driver;
using Planner.Repositories.Organizations.Adding;

namespace Planner.Repositories.Organizations.Listing;

/// <summary>
/// Read model for listing the organizations the Planner tracks.
/// </summary>
/// <param name="Id">The organization identity.</param>
/// <param name="Name">The name of the organization.</param>
[ReadModel]
[FromEvent<OrganizationAdded>]
public record Organization(OrganizationId Id, OrganizationName Name)
{
    /// <summary>
    /// Observes all organizations.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the organizations.</param>
    /// <returns>An observable of all organizations.</returns>
    public static ISubject<IEnumerable<Organization>> AllOrganizations(IMongoCollection<Organization> collection) =>
        collection.Observe();
}
