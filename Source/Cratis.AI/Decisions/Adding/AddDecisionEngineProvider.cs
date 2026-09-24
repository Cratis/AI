// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Common;
using Cratis.AI.Providers;

namespace Cratis.AI.Decisions.Adding;

/// <summary>
/// Command for adding a Decision Engine provider - an endpoint speaking Decision API v1, pinned to
/// the model it weighs choices with.
/// </summary>
/// <param name="Name">The provider's display name.</param>
/// <param name="Endpoint">The endpoint Decision API v1 requests are sent to.</param>
/// <param name="Model">The model the engine weighs choices with.</param>
/// <param name="ApiKey">The API key, when the endpoint requires one.</param>
/// <remarks>
/// The model is pinned on the provider rather than supplied per call, the same way Studio's
/// provider shape pins one: a decision engine hosts exactly one loaded model, and a caller naming a
/// different one would be asking for something the service cannot serve.
/// </remarks>
[Command]
public record AddDecisionEngineProvider(AIProviderName Name, AIProviderEndpoint Endpoint, ModelName Model, AIProviderApiKey ApiKey)
{
    /// <summary>
    /// Handles the command by opening a new provider stream and appending a
    /// <see cref="DecisionEngineProviderAdded"/> event, with the API key protected at rest.
    /// </summary>
    /// <returns>A tuple of the provider identity (event source) and the event.</returns>
    public (AIProviderId, DecisionEngineProviderAdded) Handle() =>
        (AIProviderId.New(), new(Name, Endpoint, Model, ApiKey));
}

/// <summary>
/// Represents the validator for the <see cref="AddDecisionEngineProvider"/> command.
/// </summary>
public class AddDecisionEngineProviderValidator : CommandValidator<AddDecisionEngineProvider>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AddDecisionEngineProviderValidator"/> class.
    /// </summary>
    public AddDecisionEngineProviderValidator()
    {
        RuleFor(_ => _.Name).NotEqual(AIProviderName.NotSet).WithMessage("A name is required");
        RuleFor(_ => _.Endpoint).NotEqual(AIProviderEndpoint.NotSet).WithMessage("An endpoint is required");
        RuleFor(_ => _.Model).NotNull().WithMessage("A model is required");
    }
}

/// <summary>
/// Event raised when a Decision Engine provider has been added.
/// </summary>
/// <param name="Name">The provider's display name.</param>
/// <param name="Endpoint">The endpoint Decision API v1 requests are sent to.</param>
/// <param name="Model">The model the engine weighs choices with.</param>
/// <param name="ApiKey">The API key, when the endpoint requires one, protected at rest.</param>
[EventType]
public record DecisionEngineProviderAdded(AIProviderName Name, AIProviderEndpoint Endpoint, ModelName Model, AIProviderApiKey ApiKey);
