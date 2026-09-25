// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Decisions.Jev;
using Cratis.Monads;

namespace Cratis.AI.Decisions.Configuring;

/// <summary>
/// Command for making decisions through TypeSafe AI's Jev.
/// </summary>
/// <param name="ApiKey">The TypeSafe API key - blank keeps the key already recorded.</param>
/// <param name="Model">The Jev model - blank means <c>jev-latest</c>.</param>
/// <param name="Endpoint">The base address - blank means TypeSafe AI's own API.</param>
/// <remarks>
/// Choosing Jev replaces whatever engine was in force: there is only ever one decision engine, so
/// this is a selection, not an addition to a list.
/// </remarks>
[Command]
public record UseJevDecisionEngine(
    DecisionEngineApiKey ApiKey,
    ModelName Model,
    DecisionEngineEndpoint Endpoint) : ICanProvideEventSourceId
{
    /// <summary>
    /// Gets the one identity the decision engine configuration is recorded under.
    /// </summary>
    /// <returns>The event source id.</returns>
    public EventSourceId GetEventSourceId() => DecisionEngineId.Default;

    /// <summary>
    /// Handles the command by appending a <see cref="JevDecisionEngineSelected"/> event, with the API
    /// key protected at rest.
    /// </summary>
    /// <param name="current">The decision engine as configured so far - <see langword="null"/> when nothing has been configured.</param>
    /// <returns>The event, or a validation error when there is no API key to use or the endpoint is not an address.</returns>
    public Result<JevDecisionEngineSelected, ValidationResult> Handle(ConfiguredDecisionEngine? current)
    {
        var apiKey = IsBlank(ApiKey?.Value) ? current?.ApiKey ?? DecisionEngineApiKey.NotSet : ApiKey!;
        if (IsBlank(apiKey.Value))
        {
            return ValidationResult.Error("An API key is required");
        }

        var endpoint = IsBlank(Endpoint?.Value) ? JevDefaults.Endpoint : Endpoint!;
        if (!Uri.TryCreate(endpoint.Value, UriKind.Absolute, out _))
        {
            return ValidationResult.Error("The endpoint must be an absolute address");
        }

        return new JevDecisionEngineSelected(
            apiKey,
            IsBlank(Model?.Value) ? JevDefaults.Model : Model!,
            endpoint);
    }

    static bool IsBlank(string? value) => string.IsNullOrWhiteSpace(value);
}

/// <summary>
/// Event raised when TypeSafe AI's Jev has been chosen to make decisions through.
/// </summary>
/// <param name="ApiKey">The TypeSafe API key, protected at rest.</param>
/// <param name="Model">The Jev model.</param>
/// <param name="Endpoint">The base address Jev is reached on.</param>
[EventType]
public record JevDecisionEngineSelected(DecisionEngineApiKey ApiKey, ModelName Model, DecisionEngineEndpoint Endpoint);
