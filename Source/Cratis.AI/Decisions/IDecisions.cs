// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions;

/// <summary>
/// Asks bounded questions of the configured decision provider - context in, a probability
/// distribution over the supplied choices out.
/// </summary>
/// <remarks>
/// <para>
/// A decision is not a completion, which is why this is a separate surface from
/// <see cref="Providers.IAIProviderClient"/> rather than another method on it. A caller supplies
/// the outcomes; the provider only weighs them. Nothing here generates text.
/// </para>
/// <para>
/// This surface deliberately implements <b>no</b> thresholds, fallback or retry policy. What counts
/// as confident enough, and what to do when it is not, is workflow policy that differs per caller -
/// see the consuming product's own decision gate.
/// </para>
/// </remarks>
public interface IDecisions
{
    /// <summary>
    /// Weighs one set of choices against one context.
    /// </summary>
    /// <param name="request">The request.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The <see cref="DecisionResult"/>.</returns>
    /// <exception cref="DecisionProviderNotConfigured">Thrown when no decision provider has been configured.</exception>
    /// <exception cref="ProviderDoesNotSupportDecisions">Thrown when the configured provider cannot make decisions.</exception>
    /// <exception cref="DecisionRequestIsNotAnswerable">Thrown when the request has no context or no choices.</exception>
    Task<DecisionResult> Decide(DecisionRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Weighs several independent questions in one round trip.
    /// </summary>
    /// <param name="requests">The requests.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The results, in the order the requests were supplied.</returns>
    /// <remarks>
    /// Exists for callers that score many candidates against one task - relevance filtering scores
    /// tens of items per agent invocation, and paying a round trip each would cost more than the
    /// filtering saves. Order is guaranteed to match the input so callers can zip results back onto
    /// their candidates positionally.
    /// </remarks>
    Task<IReadOnlyList<DecisionResult>> Decide(IReadOnlyList<DecisionRequest> requests, CancellationToken cancellationToken = default);
}
