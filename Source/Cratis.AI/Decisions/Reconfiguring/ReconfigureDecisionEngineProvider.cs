// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Common;
using Cratis.AI.Providers;
using Cratis.Monads;

namespace Cratis.AI.Decisions.Reconfiguring;

/// <summary>
/// Command for changing a Decision Engine provider's endpoint, model and/or API key - a blank API
/// key keeps whatever is already recorded.
/// </summary>
/// <param name="Provider">The provider to reconfigure.</param>
/// <param name="Endpoint">The new endpoint.</param>
/// <param name="Model">The new model.</param>
/// <param name="ApiKey">The new API key - blank keeps the current one.</param>
[Command]
public record ReconfigureDecisionEngineProvider(AIProviderId Provider, AIProviderEndpoint Endpoint, ModelName Model, AIProviderApiKey ApiKey)
{
    /// <summary>
    /// Handles the command by appending a <see cref="DecisionEngineProviderReconfigured"/> event.
    /// </summary>
    /// <param name="current">The provider as configured so far - <see langword="null"/> when there is none.</param>
    /// <param name="protector">The <see cref="ISecretProtector"/> a newly supplied key is protected through.</param>
    /// <returns>The event, or a validation error when the provider is not configured.</returns>
    public async Task<Result<DecisionEngineProviderReconfigured, ValidationResult>> Handle(ConfiguredAIProvider? current, ISecretProtector protector)
    {
        if (current is null)
        {
            return ValidationResult.Error("The provider is not configured");
        }

        return new DecisionEngineProviderReconfigured(
            Endpoint,
            Model,
            ApiKey.Equals(AIProviderApiKey.NotSet) ? current.ApiKey : (AIProviderApiKey)await protector.Protect(ApiKey));
    }
}

/// <summary>
/// Represents the validator for the <see cref="ReconfigureDecisionEngineProvider"/> command.
/// </summary>
public class ReconfigureDecisionEngineProviderValidator : CommandValidator<ReconfigureDecisionEngineProvider>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ReconfigureDecisionEngineProviderValidator"/> class.
    /// </summary>
    public ReconfigureDecisionEngineProviderValidator()
    {
        RuleFor(_ => _.Endpoint).NotEqual(AIProviderEndpoint.NotSet).WithMessage("An endpoint is required");
        RuleFor(_ => _.Model).NotNull().WithMessage("A model is required");
    }
}

/// <summary>
/// Event raised when a Decision Engine provider's endpoint, model and/or API key has been changed.
/// </summary>
/// <param name="Endpoint">The new endpoint.</param>
/// <param name="Model">The new model.</param>
/// <param name="ApiKey">The new API key, protected at rest.</param>
[EventType(EventTypeId)]
public record DecisionEngineProviderReconfigured(AIProviderEndpoint Endpoint, ModelName Model, AIProviderApiKey ApiKey)
{
    /// <summary>
    /// The pinned <see cref="EventTypeAttribute"/> id for this event type - chosen once, here, and
    /// never changed (decision 0002).
    /// </summary>
    public const string EventTypeId = "DecisionEngineProviderReconfigured";
}
