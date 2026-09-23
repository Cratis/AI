// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Providers;

namespace Cratis.AI.Decisions;

/// <summary>
/// Which configured provider and model decisions are made through - supplied by the consuming
/// product, the same way <see cref="Abstractions.IAIAgents"/> and
/// <see cref="Abstractions.ISecretProtector"/> are.
/// </summary>
/// <remarks>
/// The package deliberately does not decide this for itself. Which provider serves decisions is a
/// product setting - a built-in platform engine for one host, a user-configured provider for
/// another - and resolving it here would mean this package owning a settings surface it has no
/// business owning.
/// </remarks>
public interface IDecisionProviderResolver
{
    /// <summary>
    /// Resolves the provider and model decisions should be made through.
    /// </summary>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The selection, or <see langword="null"/> when decisions are unconfigured or disabled.</returns>
    Task<DecisionProviderSelection?> Resolve(CancellationToken cancellationToken = default);
}

/// <summary>
/// The provider and model a decision is made through.
/// </summary>
/// <param name="Provider">The configured provider.</param>
/// <param name="Model">The model.</param>
public record DecisionProviderSelection(ConfiguredAIProvider Provider, ModelName Model);
