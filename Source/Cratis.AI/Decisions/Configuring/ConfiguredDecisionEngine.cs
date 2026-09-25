// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Decisions.Configuring;

/// <summary>
/// The decision engine as it has been configured - what decisions are resolved through.
/// </summary>
/// <param name="Id">The one identity the configuration is recorded under.</param>
/// <param name="Type">Which engine was chosen last.</param>
/// <remarks>
/// <para>
/// Passive and read by identity, like <see cref="Providers.ConfiguredAIProvider"/>: it carries the
/// API key, so it never lands in a queryable collection, and it is only ever needed one instance at
/// a time.
/// </para>
/// <para>
/// Choosing the built-in engine leaves the Jev settings in place rather than clearing them, so
/// switching back to Jev does not ask for the key a second time.
/// </para>
/// </remarks>
[ReadModel]
[Passive]
[FromEvent<BuiltInDecisionEngineSelected>]
[FromEvent<JevDecisionEngineSelected>]
public record ConfiguredDecisionEngine(
    DecisionEngineId Id,
    [SetValue<BuiltInDecisionEngineSelected>(DecisionEngineType.BuiltIn)]
    [SetValue<JevDecisionEngineSelected>(DecisionEngineType.Jev)]
    DecisionEngineType Type)
{
    /// <summary>
    /// Gets the Jev API key, protected at rest - <see cref="DecisionEngineApiKey.NotSet"/> until Jev has been configured.
    /// </summary>
    /// <remarks>
    /// A sentinel rather than <see langword="null"/>: a nullable property on a passive read model
    /// reads back null from the running kernel whatever the events say.
    /// </remarks>
    [SetFrom<JevDecisionEngineSelected>(nameof(JevDecisionEngineSelected.ApiKey))]
    public DecisionEngineApiKey ApiKey { get; init; } = DecisionEngineApiKey.NotSet;

    /// <summary>
    /// Gets the Jev model - <see cref="ModelName.NotSet"/> until Jev has been configured.
    /// </summary>
    [SetFrom<JevDecisionEngineSelected>(nameof(JevDecisionEngineSelected.Model))]
    public ModelName Model { get; init; } = ModelName.NotSet;

    /// <summary>
    /// Gets the base address Jev is reached on - <see cref="DecisionEngineEndpoint.NotSet"/> until Jev has been configured.
    /// </summary>
    [SetFrom<JevDecisionEngineSelected>(nameof(JevDecisionEngineSelected.Endpoint))]
    public DecisionEngineEndpoint Endpoint { get; init; } = DecisionEngineEndpoint.NotSet;
}
