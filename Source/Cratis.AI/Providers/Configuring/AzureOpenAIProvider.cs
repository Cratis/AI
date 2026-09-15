// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Common;
using Cratis.Monads;

namespace Cratis.AI.Providers.Configuring;

/// <summary>
/// Command for adding an Azure OpenAI resource as an AI provider - configures how to reach it only,
/// not a deployment. Ported from Studio's own
/// <c>Settings.AI.Providers.Adding.AddAzureOpenAIProvider</c> - see
/// <see cref="AnthropicModelConfigured"/>'s remarks for why this vendor family has its own
/// <c>Configuring</c> namespace, shaped differently from <see cref="Adding.AzureOpenAIProviderAdded"/>.
/// </summary>
/// <param name="Name">The name the organization knows the provider by.</param>
/// <param name="Endpoint">The Azure OpenAI resource endpoint.</param>
/// <param name="ApiKey">The Azure OpenAI API key.</param>
[Command]
public record AddAzureOpenAIProvider(AIProviderName Name, AIProviderEndpoint Endpoint, AIProviderApiKey ApiKey)
{
    /// <summary>
    /// Handles the command by generating an identifier and appending an
    /// <see cref="AzureOpenAIModelConfigured"/> event.
    /// </summary>
    /// <param name="protector">The <see cref="ISecretProtector"/> the key is protected through.</param>
    /// <returns>A tuple of the provider identity (event source) and the event.</returns>
    public async Task<(AIProviderId, AzureOpenAIModelConfigured)> Handle(ISecretProtector protector) =>
        (AIProviderId.New(), new(Name, Endpoint, await protector.Protect(ApiKey), ModelName.NotSet));
}

/// <summary>
/// Represents the validator for the <see cref="AddAzureOpenAIProvider"/> command.
/// </summary>
public class AddAzureOpenAIProviderValidator : CommandValidator<AddAzureOpenAIProvider>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AddAzureOpenAIProviderValidator"/> class.
    /// </summary>
    public AddAzureOpenAIProviderValidator()
    {
        RuleFor(_ => _.Name).NotEqual(AIProviderName.NotSet).WithMessage("A name is required");
        RuleFor(_ => _.Endpoint.Value)
            .Must(value => Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps)
            .WithMessage("Endpoint must be a valid HTTPS URL")
            .When(_ => _.Endpoint is not null);
        RuleFor(_ => _.ApiKey).NotEqual(AIProviderApiKey.NotSet).WithMessage("An API key is required");
        RuleFor(_ => _.ApiKey.Value)
            .Must(value => !value.StartsWith("sk-ant-", StringComparison.Ordinal))
            .WithMessage("This is an Anthropic API key ('sk-ant-...') - add the provider as Anthropic instead.")
            .When(_ => _.ApiKey is not null);
    }
}

/// <summary>
/// Command for changing the configuration of an Azure OpenAI resource, keeping its identifier so
/// anything already pointing at the provider keeps working. Ported from Studio's own
/// <c>Settings.AI.Providers.Reconfiguring.ReconfigureAzureOpenAIProvider</c>.
/// </summary>
/// <param name="Provider">The provider to reconfigure.</param>
/// <param name="Name">The name the organization knows the provider by.</param>
/// <param name="Endpoint">The new endpoint.</param>
/// <param name="ApiKey">The new API key - blank keeps the current one.</param>
[Command]
public record ReconfigureAzureOpenAIProvider(AIProviderId Provider, AIProviderName Name, AIProviderEndpoint Endpoint, AIProviderApiKey ApiKey)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AzureOpenAIModelConfigured"/> event.
    /// </summary>
    /// <param name="current">The provider as configured so far - <see langword="null"/> when there is none.</param>
    /// <param name="protector">The <see cref="ISecretProtector"/> a newly supplied key is protected through.</param>
    /// <returns>The event, or a validation error when the provider is not configured.</returns>
    public async Task<Result<AzureOpenAIModelConfigured, ValidationResult>> Handle(ConfiguredAIProvider? current, ISecretProtector protector)
    {
        if (current is null)
        {
            return ValidationResult.Error("The provider is not configured");
        }

        var apiKey = ApiKey.Equals(AIProviderApiKey.NotSet) ? current.ApiKey : (AIProviderApiKey)await protector.Protect(ApiKey);
        return new AzureOpenAIModelConfigured(Name, Endpoint, apiKey, ModelName.NotSet);
    }
}

/// <summary>
/// Represents the validator for the <see cref="ReconfigureAzureOpenAIProvider"/> command.
/// </summary>
public class ReconfigureAzureOpenAIProviderValidator : CommandValidator<ReconfigureAzureOpenAIProvider>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ReconfigureAzureOpenAIProviderValidator"/> class.
    /// </summary>
    public ReconfigureAzureOpenAIProviderValidator()
    {
        RuleFor(_ => _.Name).NotEqual(AIProviderName.NotSet).WithMessage("A name is required");
        RuleFor(_ => _.Endpoint.Value)
            .Must(value => Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps)
            .WithMessage("Endpoint must be a valid HTTPS URL")
            .When(_ => _.Endpoint is not null);
        RuleFor(_ => _.ApiKey.Value)
            .Must(value => !value.StartsWith("sk-ant-", StringComparison.Ordinal))
            .WithMessage("This is an Anthropic API key ('sk-ant-...') - add the provider as Anthropic instead.")
            .When(_ => _.ApiKey is not null);
    }
}

/// <summary>
/// Event raised when a model has been configured to run against an Azure OpenAI resource - raised
/// both when the provider is first added and whenever its configuration changes. Ported from
/// Studio's own <c>Settings.AI.Providers.Adding.AzureOpenAIModelConfigured</c> - see
/// <see cref="AnthropicModelConfigured"/>'s remarks for the shape and id-pinning reasoning, which
/// applies identically here.
/// </summary>
/// <param name="Name">The name the organization knows the provider by.</param>
/// <param name="Endpoint">The Azure OpenAI resource endpoint.</param>
/// <param name="ApiKey">The Azure OpenAI API key, protected at rest.</param>
/// <param name="DeploymentName">The name of the deployment addressing the model - unset until a future feature sets one.</param>
[EventType(EventTypeId)]
public record AzureOpenAIModelConfigured(AIProviderName Name, AIProviderEndpoint Endpoint, AIProviderApiKey ApiKey, ModelName DeploymentName)
{
    /// <summary>
    /// The pinned <see cref="EventTypeAttribute"/> id for this event type - see
    /// <see cref="AnthropicModelConfigured"/>'s remarks.
    /// </summary>
    public const string EventTypeId = "AzureOpenAIModelConfigured";
}
