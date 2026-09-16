// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Common;
using Cratis.Monads;

namespace Cratis.AI.Providers.Configuring;

/// <summary>
/// Command for adding Anthropic as an AI provider - configures the credential only, not a model:
/// which model to run is chosen per agent. Ported from Studio's own
/// <c>Settings.AI.Providers.Adding.AddAnthropicProvider</c> (plan Section 5.2 step 4), which shapes
/// this differently from Direct's donor - see <see cref="AnthropicModelConfigured"/>'s own remarks
/// for why this whole vendor family lives in its own <c>Configuring</c> namespace rather than
/// reusing <see cref="Adding.AnthropicProviderAdded"/>.
/// </summary>
/// <param name="Name">The name the organization knows the provider by.</param>
/// <param name="ApiKey">The Anthropic API key.</param>
[Command]
public record AddAnthropicProvider(AIProviderName Name, AIProviderApiKey ApiKey)
{
    /// <summary>
    /// Handles the command by generating an identifier and appending an
    /// <see cref="AnthropicModelConfigured"/> event.
    /// </summary>
    /// <param name="protector">The <see cref="ISecretProtector"/> the key is protected through.</param>
    /// <returns>A tuple of the provider identity (event source) and the event.</returns>
    public async Task<(AIProviderId, AnthropicModelConfigured)> Handle(ISecretProtector protector) =>
        (AIProviderId.New(), new(Name, await protector.Protect(ApiKey), ModelName.NotSet));
}

/// <summary>
/// Represents the validator for the <see cref="AddAnthropicProvider"/> command.
/// </summary>
public class AddAnthropicProviderValidator : CommandValidator<AddAnthropicProvider>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AddAnthropicProviderValidator"/> class.
    /// </summary>
    public AddAnthropicProviderValidator()
    {
        RuleFor(_ => _.Name).NotEqual(AIProviderName.NotSet).WithMessage("A name is required");
        RuleFor(_ => _.ApiKey).NotEqual(AIProviderApiKey.NotSet).WithMessage("An API key is required");
        RuleFor(_ => _.ApiKey.Value)
            .Must(value => value.StartsWith("sk-ant-", StringComparison.Ordinal))
            .WithMessage("Anthropic API keys start with 'sk-ant-'. If this key is for another service, add that provider type instead.")
            .When(_ => _.ApiKey is not null && _.ApiKey != AIProviderApiKey.NotSet);
    }
}

/// <summary>
/// Command for changing the configuration of a model hosted by Anthropic, keeping its identifier so
/// anything already pointing at the provider keeps working. Ported from Studio's own
/// <c>Settings.AI.Providers.Reconfiguring.ReconfigureAnthropicProvider</c> (plan Section 5.2 step 4).
/// </summary>
/// <param name="Id">The identifier of the provider to reconfigure.</param>
/// <param name="Name">The name the organization knows the provider by.</param>
/// <param name="ApiKey">The new API key - blank keeps the current one.</param>
[Command]
public record ReconfigureAnthropicProvider(AIProviderId Id, AIProviderName Name, AIProviderApiKey ApiKey)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AnthropicModelConfigured"/> event.
    /// </summary>
    /// <param name="current">The provider as configured so far - <see langword="null"/> when there is none.</param>
    /// <param name="protector">The <see cref="ISecretProtector"/> a newly supplied key is protected through.</param>
    /// <returns>The event, or a validation error when the provider is not configured.</returns>
    public async Task<Result<AnthropicModelConfigured, ValidationResult>> Handle(ConfiguredAIProvider? current, ISecretProtector protector)
    {
        if (current is null)
        {
            return ValidationResult.Error("The provider is not configured");
        }

        var apiKey = ApiKey.Equals(AIProviderApiKey.NotSet) ? current.ApiKey : (AIProviderApiKey)await protector.Protect(ApiKey);
        return new AnthropicModelConfigured(Name, apiKey, ModelName.NotSet);
    }
}

/// <summary>
/// Represents the validator for the <see cref="ReconfigureAnthropicProvider"/> command.
/// </summary>
public class ReconfigureAnthropicProviderValidator : CommandValidator<ReconfigureAnthropicProvider>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ReconfigureAnthropicProviderValidator"/> class.
    /// </summary>
    public ReconfigureAnthropicProviderValidator()
    {
        RuleFor(_ => _.Name).NotEqual(AIProviderName.NotSet).WithMessage("A name is required");
        RuleFor(_ => _.ApiKey.Value)
            .Must(value => value.StartsWith("sk-ant-", StringComparison.Ordinal))
            .WithMessage("Anthropic API keys start with 'sk-ant-'. If this key is for another service, add that provider type instead.")
            .When(_ => _.ApiKey is not null && _.ApiKey != AIProviderApiKey.NotSet);
    }
}

/// <summary>
/// Event raised when a model has been configured to run against Anthropic - raised both when the
/// provider is first added and whenever its configuration changes, since either way the fact is the
/// same. Ported from Studio's own <c>Settings.AI.Providers.Adding.AnthropicModelConfigured</c>.
/// </summary>
/// <remarks>
/// <para>
/// This is <em>not</em> the same fact <see cref="Adding.AnthropicProviderAdded"/>/
/// <see cref="Reconfiguring.AnthropicProviderReconfigured"/> record for Direct - Studio's provider
/// model unifies add and reconfigure into one event and carries a <see cref="Model"/> identifier
/// Direct's shape has no equivalent for (an agent picks the model on Direct; a provider can pin one
/// directly on Studio, though nothing sets it today - Studio's own commands always pass
/// <see cref="ModelName.NotSet"/>, preserved here only so a value already stored keeps its meaning).
/// Forcing one shape onto both products during a "just moving code" migration would have silently
/// changed a real, already-stored contract for whichever product lost the argument - this package
/// instead carries both real shapes, each in its own donor-matching namespace.
/// </para>
/// <para>
/// <b>The explicit id is pinned and must never change</b> (decision 0002) - the bare type name as a
/// string, matching exactly what Studio's own pre-migration same-named type already resolves to
/// implicitly (decisions 0007/0008), so Studio's real, already-stored provider events stay readable
/// through this type once Studio's own duplicate is deleted.
/// </para>
/// </remarks>
/// <param name="Name">The name the organization knows the provider by.</param>
/// <param name="ApiKey">The Anthropic API key, protected at rest.</param>
/// <param name="Model">The identifier Anthropic knows the model by - unset until a future feature sets one; an agent supplies the model today.</param>
[EventType(EventTypeId)]
public record AnthropicModelConfigured(AIProviderName Name, AIProviderApiKey ApiKey, ModelName Model)
{
    /// <summary>
    /// The pinned <see cref="EventTypeAttribute"/> id for this event type - see the remarks above.
    /// </summary>
    public const string EventTypeId = "AnthropicModelConfigured";
}
