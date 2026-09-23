// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Providers;

namespace Cratis.AI.Decisions;

/// <summary>
/// A vendor-specific decision client for one <see cref="AIProviderType"/>, mirroring
/// <see cref="IAIProviderClient"/>'s shape - one implementation per vendor, so adding a second
/// decision backend later needs no change to any caller.
/// </summary>
public interface IDecisionProviderClient
{
    /// <summary>
    /// Gets the vendor this client talks to.
    /// </summary>
    AIProviderType Type { get; }

    /// <summary>
    /// Weighs the choices in a request.
    /// </summary>
    /// <param name="request">The request.</param>
    /// <param name="provider">The configured provider to call.</param>
    /// <param name="model">The model to weigh the choices with.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The distribution, one entry per supplied choice, in any order.</returns>
    Task<IReadOnlyList<DecisionOutcome>> Decide(
        DecisionRequest request,
        ConfiguredAIProvider provider,
        ModelName model,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Weighs several requests in one round trip.
    /// </summary>
    /// <param name="requests">The requests.</param>
    /// <param name="provider">The configured provider to call.</param>
    /// <param name="model">The model to weigh the choices with.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>One distribution per request, in the order the requests were supplied.</returns>
    /// <remarks>
    /// A client whose backend has no batch endpoint satisfies this by looping - correctness first,
    /// and the seam stays available to backends that can do better.
    /// </remarks>
    Task<IReadOnlyList<IReadOnlyList<DecisionOutcome>>> Decide(
        IReadOnlyList<DecisionRequest> requests,
        ConfiguredAIProvider provider,
        ModelName model,
        CancellationToken cancellationToken = default);
}
