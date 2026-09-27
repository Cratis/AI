// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Decisions.Health;
using Cratis.AI.Decisions.Jev;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Decisions.Configuring;

/// <summary>
/// What a settings page shows about the decision engine - which one is in force, what each option
/// is configured with, and whether the one in force can answer. Never carries the API key itself.
/// </summary>
/// <param name="Type">The engine in force.</param>
/// <param name="IsExplicitlyChosen">Whether somebody chose the engine, rather than it being the built-in fallback.</param>
/// <param name="IsAvailable">Whether any engine is available at all.</param>
/// <param name="Model">The model the engine in force weighs choices with.</param>
/// <param name="BuiltInIsAvailable">Whether this deployment ships a built-in engine.</param>
/// <param name="BuiltInModel">The model the built-in engine is deployed with.</param>
/// <param name="JevModel">The Jev model, as configured or the default.</param>
/// <param name="JevEndpoint">The Jev endpoint, as configured or the default.</param>
/// <param name="JevHasApiKey">Whether a Jev API key has been recorded.</param>
/// <param name="IsReachable">Whether the engine in force answered its last health check.</param>
/// <param name="Detail">What the last health check found.</param>
[ReadModel]
public record DecisionEngineSettings(
    DecisionEngineType Type,
    bool IsExplicitlyChosen,
    bool IsAvailable,
    string Model,
    bool BuiltInIsAvailable,
    string BuiltInModel,
    string JevModel,
    string JevEndpoint,
    bool JevHasApiKey,
    bool IsReachable,
    string Detail)
{
    /// <summary>
    /// Gets the decision engine settings.
    /// </summary>
    /// <param name="readModels">The <see cref="IReadModels"/> the configuration is read from.</param>
    /// <param name="resolver">Resolves the engine in force.</param>
    /// <param name="health">Reports whether the engine in force can answer.</param>
    /// <param name="builtIn">Where the built-in engine lives, when this deployment has one.</param>
    /// <returns>The <see cref="DecisionEngineSettings"/>.</returns>
    public static async Task<DecisionEngineSettings> CurrentDecisionEngine(
        IReadModels readModels,
        IDecisionEngineResolver resolver,
        IDecisionEngineHealth health,
        IOptions<BuiltInDecisionEngineOptions> builtIn)
    {
        var configured = await readModels.GetInstanceById<ConfiguredDecisionEngine>((EventSourceId)DecisionEngineId.Default);
        var inForce = await resolver.Resolve();
        var probe = await health.Current();
        var jevConfigured = configured is not null && !string.IsNullOrWhiteSpace(configured.ApiKey.Value);

        return new(
            Type: inForce?.Type ?? DecisionEngineType.BuiltIn,
            IsExplicitlyChosen: configured is not null,
            IsAvailable: inForce is not null,
            Model: inForce?.Model.Value ?? string.Empty,
            BuiltInIsAvailable: builtIn.Value.IsAvailable,
            BuiltInModel: builtIn.Value.Model,
            JevModel: jevConfigured && !string.IsNullOrWhiteSpace(configured!.Model.Value) ? configured.Model.Value : JevDefaults.Model.Value,
            JevEndpoint: jevConfigured && !string.IsNullOrWhiteSpace(configured!.Endpoint.Value) ? configured.Endpoint.Value : JevDefaults.Endpoint.Value,
            JevHasApiKey: jevConfigured,
            IsReachable: probe.IsReachable,
            Detail: probe.Detail);
    }
}
