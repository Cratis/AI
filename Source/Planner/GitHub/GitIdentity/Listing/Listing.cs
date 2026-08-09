// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using MongoDB.Driver;
using Planner.GitHub.GitIdentity.Setting;

namespace Planner.GitHub.GitIdentity.Listing;

/// <summary>
/// Read model for the git identity worker containers commit as. There is exactly one per
/// deployment - the frontend and the work dispatcher both take the first (and only) item.
/// </summary>
/// <param name="Id">The fixed git identity id.</param>
/// <param name="Name">The <c>git config user.name</c> to commit as.</param>
/// <param name="Email">The <c>git config user.email</c> to commit as.</param>
[ReadModel]
[FromEvent<GitIdentitySet>]
public record ConfiguredGitIdentity(GitIdentityId Id, GitUserName Name, GitUserEmail Email)
{
    /// <summary>
    /// Observes the configured git identity.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the git identity.</param>
    /// <returns>An observable of the git identity - empty until one has been set.</returns>
    public static ISubject<IEnumerable<ConfiguredGitIdentity>> CurrentGitIdentity(IMongoCollection<ConfiguredGitIdentity> collection) =>
        collection.Observe();
}
