// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Reactive.Subjects;
using Cratis.AI.Providers.Pools.AddingProvider;
using Cratis.AI.Providers.Pools.Creating;
using Cratis.AI.Providers.Pools.Removing;
using Cratis.AI.Providers.Pools.RemovingProvider;
using Cratis.AI.Providers.Pools.Renaming;
using MongoDB.Driver;

namespace Cratis.AI.Providers.Pools.Listing;

/// <summary>
/// A provider within a pool (#871) - a member names a provider and nothing else: the acting agent's
/// capability tier, translated through the member provider's own tier mapping, decides which model
/// a completion dispatched to it runs on.
/// </summary>
/// <param name="ProviderId">The provider.</param>
public record AIProviderPoolMember(AIProviderId ProviderId);

/// <summary>
/// Read model for listing AI provider pools and their members. Carries no credentials - members
/// reference providers by id, and the credential-bearing side stays behind
/// <c>ConfiguredAIProvider</c>'s no-query wall.
/// </summary>
/// <param name="Id">The pool's identity.</param>
/// <param name="Name">The pool's display name.</param>
/// <param name="Members">The providers in the pool - each a bare provider reference, the acting agent's tier deciding the model on it.</param>
[ReadModel]
[FromEvent<AIProviderPoolCreated>]
[RemovedWith<AIProviderPoolRemoved>]
public record AIProviderPool(
    AIProviderPoolId Id,
    [SetFrom<AIProviderPoolRenamed>(nameof(AIProviderPoolRenamed.Name))]
    AIProviderPoolName Name,
    [ChildrenFrom<ProviderAddedToPool>(key: nameof(ProviderAddedToPool.Provider), identifiedBy: nameof(AIProviderPoolMember.ProviderId))]
    [RemovedWith<ProviderRemovedFromPool>(key: nameof(ProviderRemovedFromPool.Provider))]
    IEnumerable<AIProviderPoolMember>? Members = null)
{
    /// <summary>
    /// Observes every AI provider pool.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the pools.</param>
    /// <returns>An observable of every pool.</returns>
    public static ISubject<IEnumerable<AIProviderPool>> AllAIProviderPools(IMongoCollection<AIProviderPool> collection) =>
        collection.Observe();
}
