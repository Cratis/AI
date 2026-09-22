// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.Monads;

namespace Cratis.AI.Providers.UsageReporting.SettingCredential;

/// <summary>
/// Command for setting the Admin API key a configured AI provider's usage report is read through -
/// separate from the completions key, since the vendors that publish organization usage and cost
/// reports (Anthropic, OpenAI) gate them behind a distinct Admin-scoped credential that a completions
/// key is rejected by. Ported from Direct's
/// <c>AIProviders.UsageReporting.SettingCredential.SetAIProviderUsageCredential</c>
/// (migration-status.md, "Usage reporting").
/// </summary>
/// <remarks>
/// Setting and clearing are two commands rather than one with a blank sentinel. A blank field
/// meaning "erase the credential" here while the very same blank field means "keep the current one"
/// in the provider's other credential is a trap, and it becomes a live one once both fields sit in
/// the same dialog. Clearing is its own deliberate act, which also lets the read side say truthfully
/// whether a provider has a usage credential at all.
/// </remarks>
/// <param name="Provider">The provider to set the usage credential for.</param>
/// <param name="UsageApiKey">The usage Admin API key.</param>
[Command]
public record SetAIProviderUsageCredential(AIProviderId Provider, AIProviderApiKey UsageApiKey)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AIProviderUsageCredentialSet"/> event.
    /// </summary>
    /// <param name="current">The provider as configured so far - <see langword="null"/> when there is none.</param>
    /// <param name="protector">The <see cref="ISecretProtector"/> the key is protected through.</param>
    /// <returns>The event, or a validation error when the provider is not configured.</returns>
    public async Task<Result<AIProviderUsageCredentialSet, ValidationResult>> Handle(ConfiguredAIProvider? current, ISecretProtector protector)
    {
        if (current is null)
        {
            return ValidationResult.Error("The provider is not configured");
        }

        return new AIProviderUsageCredentialSet((AIProviderApiKey)await protector.Protect(UsageApiKey));
    }
}

/// <summary>
/// Represents the validator for the <see cref="SetAIProviderUsageCredential"/> command.
/// </summary>
public class SetAIProviderUsageCredentialValidator : CommandValidator<SetAIProviderUsageCredential>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="SetAIProviderUsageCredentialValidator"/> class.
    /// </summary>
    public SetAIProviderUsageCredentialValidator()
    {
        RuleFor(_ => _.Provider).NotEqual(AIProviderId.NotSet).WithMessage("A provider is required");
        RuleFor(_ => _.UsageApiKey)
            .NotEqual(AIProviderApiKey.NotSet)
            .WithMessage("A usage API key is required - use Clear to remove the one already configured");
    }
}

/// <summary>
/// Command for removing the Admin API key a configured AI provider's usage report is read through.
/// Usage and cost reporting stops for that provider; nothing else about it changes.
/// </summary>
/// <param name="Provider">The provider to clear the usage credential on.</param>
[Command]
public record ClearAIProviderUsageCredential(AIProviderId Provider)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AIProviderUsageCredentialCleared"/> event.
    /// </summary>
    /// <param name="current">The provider as configured so far - <see langword="null"/> when there is none.</param>
    /// <returns>The event, or a validation error when the provider is not configured.</returns>
    public Result<AIProviderUsageCredentialCleared, ValidationResult> Handle(ConfiguredAIProvider? current) =>
        current is null
            ? ValidationResult.Error("The provider is not configured")
            : new AIProviderUsageCredentialCleared();
}

/// <summary>
/// Event raised when a configured AI provider's usage report Admin API key has been set.
/// </summary>
/// <param name="UsageApiKey">The usage Admin API key.</param>
[EventType(EventTypeId)]
public record AIProviderUsageCredentialSet(AIProviderApiKey UsageApiKey)
{
    /// <summary>
    /// The pinned <see cref="EventTypeAttribute"/> id for this event type - chosen once, here, and
    /// never changed (decision 0002). Deliberately the bare type name as a string, not a fresh guid:
    /// this is exactly the id Direct's own pre-migration same-named type already resolves to
    /// implicitly (Chronicle's own type-name fallback, decision 0007) - matching it keeps Direct's
    /// real, already-stored usage-credential events readable through this type once Direct's own
    /// duplicate is deleted, rather than orphaning them under an id nothing produces anymore
    /// (decision 0008's same reasoning, applied to the usage-reporting migration slice).
    /// </summary>
    public const string EventTypeId = "AIProviderUsageCredentialSet";
}

/// <summary>
/// Event raised when a configured AI provider's usage report Admin API key has been removed, and its
/// usage and cost reporting has therefore stopped.
/// </summary>
[EventType(EventTypeId)]
public record AIProviderUsageCredentialCleared
{
    /// <summary>
    /// The pinned <see cref="EventTypeAttribute"/> id for this event type - see
    /// <see cref="AIProviderUsageCredentialSet.EventTypeId"/> for why it matches Direct's own
    /// pre-migration implicit id rather than a fresh guid.
    /// </summary>
    public const string EventTypeId = "AIProviderUsageCredentialCleared";
}
