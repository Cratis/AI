// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Common;
using Cratis.Monads;

namespace Cratis.AI.Providers.Configuring;

/// <summary>
/// Command for adding OpenAI as an AI provider - configures the credential only, not a model. Ported
/// from Studio's own <c>Settings.AI.Providers.Adding.AddOpenAIProvider</c> - see
/// <see cref="AnthropicModelConfigured"/>'s remarks for why this vendor family has its own
/// <c>Configuring</c> namespace, shaped differently from <see cref="Adding.OpenAIProviderAdded"/>.
/// </summary>
/// <param name="Name">The name the organization knows the provider by.</param>
/// <param name="ApiKey">The OpenAI API key.</param>
[Command]
public record AddOpenAIProvider(AIProviderName Name, AIProviderApiKey ApiKey)
{
    /// <summary>
    /// Handles the command by generating an identifier and appending an
    /// <see cref="OpenAIModelConfigured"/> event.
    /// </summary>
    /// <returns>A tuple of the provider identity (event source) and the event.</returns>
    public (AIProviderId, OpenAIModelConfigured) Handle() =>
        (AIProviderId.New(), new(Name, ApiKey, ModelName.NotSet));
}

/// <summary>
/// Represents the validator for the <see cref="AddOpenAIProvider"/> command.
/// </summary>
public class AddOpenAIProviderValidator : CommandValidator<AddOpenAIProvider>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AddOpenAIProviderValidator"/> class.
    /// </summary>
    public AddOpenAIProviderValidator()
    {
        RuleFor(_ => _.Name).NotEqual(AIProviderName.NotSet).WithMessage("A name is required");
        RuleFor(_ => _.ApiKey).NotEqual(AIProviderApiKey.NotSet).WithMessage("An API key is required");
        RuleFor(_ => _.ApiKey.Value)
            .Must(value => !value.StartsWith("sk-ant-", StringComparison.Ordinal))
            .WithMessage("This is an Anthropic API key ('sk-ant-...') - add the provider as Anthropic instead.")
            .When(_ => _.ApiKey is not null);
    }
}

/// <summary>
/// Command for changing the configuration of a model hosted by OpenAI, keeping its identifier so
/// anything already pointing at the provider keeps working. Ported from Studio's own
/// <c>Settings.AI.Providers.Reconfiguring.ReconfigureOpenAIProvider</c>.
/// </summary>
/// <param name="Id">The identifier of the provider to reconfigure.</param>
/// <param name="Name">The name the organization knows the provider by.</param>
/// <param name="ApiKey">The new API key - blank keeps the current one.</param>
[Command]
public record ReconfigureOpenAIProvider(AIProviderId Id, AIProviderName Name, AIProviderApiKey ApiKey)
{
    /// <summary>
    /// Handles the command by appending an <see cref="OpenAIModelConfigured"/> event.
    /// </summary>
    /// <param name="current">The provider as configured so far - <see langword="null"/> when there is none.</param>
    /// <returns>The event, or a validation error when the provider is not configured.</returns>
    public Result<OpenAIModelConfigured, ValidationResult> Handle(ConfiguredAIProvider? current)
    {
        if (current is null)
        {
            return ValidationResult.Error("The provider is not configured");
        }

        var apiKey = ApiKey.Equals(AIProviderApiKey.NotSet) ? current.ApiKey : ApiKey;
        return new OpenAIModelConfigured(Name, apiKey, ModelName.NotSet);
    }
}

/// <summary>
/// Represents the validator for the <see cref="ReconfigureOpenAIProvider"/> command.
/// </summary>
public class ReconfigureOpenAIProviderValidator : CommandValidator<ReconfigureOpenAIProvider>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ReconfigureOpenAIProviderValidator"/> class.
    /// </summary>
    public ReconfigureOpenAIProviderValidator()
    {
        RuleFor(_ => _.Name).NotEqual(AIProviderName.NotSet).WithMessage("A name is required");
        RuleFor(_ => _.ApiKey.Value)
            .Must(value => !value.StartsWith("sk-ant-", StringComparison.Ordinal))
            .WithMessage("This is an Anthropic API key ('sk-ant-...') - add the provider as Anthropic instead.")
            .When(_ => _.ApiKey is not null);
    }
}

/// <summary>
/// Event raised when a model has been configured to run against OpenAI - raised both when the
/// provider is first added and whenever its configuration changes. Ported from Studio's own
/// <c>Settings.AI.Providers.Adding.OpenAIModelConfigured</c> - see
/// <see cref="AnthropicModelConfigured"/>'s remarks for the shape and id-pinning reasoning, which
/// applies identically here.
/// </summary>
/// <param name="Name">The name the organization knows the provider by.</param>
/// <param name="ApiKey">The OpenAI API key, protected at rest.</param>
/// <param name="Model">The identifier OpenAI knows the model by - unset until a future feature sets one.</param>
[EventType]
public record OpenAIModelConfigured(AIProviderName Name, AIProviderApiKey ApiKey, ModelName Model);
