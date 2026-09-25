// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions;

/// <summary>
/// Talks to one kind of decision engine - one implementation per <see cref="DecisionEngineType"/>,
/// discovered by convention, mirroring how a language-model vendor gets its own provider client.
/// </summary>
public interface IDecisionEngineClient
{
    /// <summary>
    /// Gets the kind of engine this client talks to.
    /// </summary>
    DecisionEngineType Type { get; }

    /// <summary>
    /// Weighs several requests, in as few round trips as the engine allows.
    /// </summary>
    /// <param name="requests">The requests.</param>
    /// <param name="connection">The engine to call.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The <see cref="DecisionEngineAnswers"/>, one distribution per request in request order.</returns>
    Task<DecisionEngineAnswers> Decide(
        IReadOnlyList<DecisionRequest> requests,
        DecisionEngineConnection connection,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks whether the engine can be reached and is ready to answer.
    /// </summary>
    /// <param name="connection">The engine to check.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The <see cref="DecisionEngineProbe"/>.</returns>
    Task<DecisionEngineProbe> Probe(DecisionEngineConnection connection, CancellationToken cancellationToken = default);
}
