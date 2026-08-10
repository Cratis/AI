// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Accounts.Credentials;
using Planner.Work.Listing;
using ListedIssue = Planner.Issues.Listing.Issue;

namespace Planner.Work.Workers;

/// <summary>
/// Defines the building of the environment a worker container runs with - what it clones, what it is
/// asked to do, and which credentials it holds while doing it.
/// </summary>
public interface IWorkerEnvironment
{
    /// <summary>
    /// Builds the environment variables for a unit of work.
    /// </summary>
    /// <param name="work">The work the container runs.</param>
    /// <param name="coveredIssues">The issues the work covers - empty for anything but issue work.</param>
    /// <param name="credentials">The Claude account credentials the session authenticates with.</param>
    /// <param name="model">The resolved model the session runs.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The environment variables.</returns>
    Task<IReadOnlyDictionary<string, string>> Build(
        WorkItem work,
        IReadOnlyList<ListedIssue> coveredIssues,
        AccountCredentials credentials,
        ModelName model,
        CancellationToken cancellationToken = default);
}
