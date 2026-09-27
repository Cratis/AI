// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions;

/// <summary>
/// Resolves which decision engine decisions are made through.
/// </summary>
/// <remarks>
/// The package's own <see cref="ConfiguredDecisionEngineResolver"/> reads the configuration
/// recorded through the <c>Configuring</c> commands and falls back to the built-in engine. A host
/// that needs something else registers its own through
/// <see cref="Configuration.CratisAIBuilder.WithDecisions{TResolver}"/>.
/// </remarks>
public interface IDecisionEngineResolver
{
    /// <summary>
    /// Resolves the engine decisions should be made through.
    /// </summary>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The connection, or <see langword="null"/> when no engine is available.</returns>
    Task<DecisionEngineConnection?> Resolve(CancellationToken cancellationToken = default);
}
