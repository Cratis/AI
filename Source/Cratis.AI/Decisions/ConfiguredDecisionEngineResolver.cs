// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Decisions.Configuring;
using Cratis.AI.Decisions.Jev;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Decisions;

/// <summary>
/// Resolves the decision engine from what has been configured through the <c>Configuring</c>
/// commands, falling back to the built-in engine.
/// </summary>
/// <param name="readModels">The <see cref="IReadModels"/> the configuration is read from.</param>
/// <param name="builtIn">Where the built-in engine lives, when this deployment has one.</param>
/// <remarks>
/// <para>
/// The built-in engine being the fallback rather than something a person has to choose is what makes
/// a host work out of the box: until somebody picks Jev, decisions go to the engine the deployment
/// ships with.
/// </para>
/// <para>
/// Scoped rather than a singleton: it reads a namespaced read model, and capturing one on a
/// long-lived root would bind it to whichever namespace resolved it first.
/// </para>
/// </remarks>
public class ConfiguredDecisionEngineResolver(
    IReadModels readModels,
    IOptions<BuiltInDecisionEngineOptions> builtIn) : IDecisionEngineResolver
{
    /// <inheritdoc/>
    public async Task<DecisionEngineConnection?> Resolve(CancellationToken cancellationToken = default)
    {
        var configured = await readModels.GetInstanceById<ConfiguredDecisionEngine>((EventSourceId)DecisionEngineId.Default);

        if (configured is { Type: DecisionEngineType.Jev } jev && !string.IsNullOrWhiteSpace(jev.ApiKey.Value))
        {
            return new(
                DecisionEngineType.Jev,
                string.IsNullOrWhiteSpace(jev.Endpoint.Value) ? JevDefaults.Endpoint : jev.Endpoint,
                jev.ApiKey,
                string.IsNullOrWhiteSpace(jev.Model.Value) ? JevDefaults.Model : jev.Model);
        }

        return BuiltIn(builtIn.Value);
    }

    /// <summary>
    /// Resolves the built-in engine, when the deployment has one.
    /// </summary>
    /// <param name="options">The <see cref="BuiltInDecisionEngineOptions"/>.</param>
    /// <returns>The connection, or <see langword="null"/> when the deployment has no built-in engine.</returns>
    internal static DecisionEngineConnection? BuiltIn(BuiltInDecisionEngineOptions options) =>
        options.IsAvailable
            ? new(
                DecisionEngineType.BuiltIn,
                options.Endpoint,
                DecisionEngineApiKey.NotSet,
                string.IsNullOrWhiteSpace(options.Model) ? ModelName.NotSet : new ModelName(options.Model))
            : null;
}
