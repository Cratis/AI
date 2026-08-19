// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using MongoDB.Driver;
using Planner.GitHub.Synchronization;
using Planner.Repositories.Adding;
using Planner.Repositories.MappingCodeRepository;
using Planner.Repositories.Removing;
using Planner.Repositories.SettingReviewGatePolicy;

namespace Planner.Repositories.Listing;

/// <summary>
/// Read model for listing the repositories the Planner tracks, together with how mirroring their issues
/// went - a repository whose issues never loaded has to say so rather than look like an empty one.
/// </summary>
/// <param name="Id">The repository identity.</param>
/// <param name="Owner">The organization owning the repository.</param>
/// <param name="Name">The name of the repository.</param>
/// <param name="CodeOwner">The organization owning the mapped code repository - <see langword="null"/> when the code lives in the repository itself.</param>
/// <param name="CodeName">The name of the mapped code repository - <see langword="null"/> when the code lives in the repository itself.</param>
/// <param name="SynchronizationStatus">How far the initial load of the repository's issues got.</param>
/// <param name="SynchronizationFailure">Why the initial load failed - empty unless <see cref="SynchronizationStatus"/> is <see cref="IssueSynchronizationStatus.Failed"/>.</param>
/// <param name="ReviewGatePolicy">Whether a pull request always waits for a person, or an agent may merge one on its own - defaults to <see cref="Planner.Repositories.ReviewGatePolicy.Human"/>.</param>
[ReadModel]
[FromEvent<RepositoryAdded>]
[FromEvent<CodeRepositoryMapped>]
[RemovedWith<RepositoryRemoved>]
public record Repository(
    RepositoryId Id,
    OrganizationName Owner,
    RepositoryName Name,
    OrganizationName? CodeOwner,
    RepositoryName? CodeName,
    [SetValue<RepositoryAdded>(IssueSynchronizationStatus.Pending)]
    [SetValue<RepositoryIssuesSynchronized>(IssueSynchronizationStatus.Synchronized)]
    [SetValue<RepositoryIssueSynchronizationFailed>(IssueSynchronizationStatus.Failed)]
    IssueSynchronizationStatus SynchronizationStatus,
    [SetValue<RepositoryAdded>("")]
    [SetValue<RepositoryIssuesSynchronized>("")]
    [SetFrom<RepositoryIssueSynchronizationFailed>(nameof(RepositoryIssueSynchronizationFailed.Reason))]
    string SynchronizationFailure,
    [SetFrom<ReviewGatePolicySet>(nameof(ReviewGatePolicySet.Policy))]
    Planner.Repositories.ReviewGatePolicy ReviewGatePolicy = Planner.Repositories.ReviewGatePolicy.Human)
{
    /// <summary>
    /// Observes all tracked repositories.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the repositories.</param>
    /// <returns>An observable of all repositories.</returns>
    public static ISubject<IEnumerable<Repository>> AllRepositories(IMongoCollection<Repository> collection) =>
        collection.Observe();

    /// <summary>
    /// Gets a single repository by its identity. The model carries <see cref="RemovedWithAttribute{T}"/>,
    /// so an unknown or removed repository resolves to a default-initialized instance - check for
    /// an empty <see cref="Owner"/> rather than <see langword="null"/>.
    /// </summary>
    /// <param name="readModels">The <see cref="IReadModels"/> to read from.</param>
    /// <param name="id">The repository identity.</param>
    /// <returns>The repository.</returns>
    public static Task<Repository> RepositoryById(IReadModels readModels, RepositoryId id) =>
        readModels.GetInstanceById<Repository>((EventSourceId)id);
}
