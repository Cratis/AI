// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.Monads;

namespace Cratis.AI.Providers.Reconfiguring;

/// <summary>
/// Command for changing an OpenAI provider's API key - a blank value keeps whatever is already
/// recorded. Ported from Direct's <c>AIProviders.Reconfiguring.ReconfigureOpenAIProvider</c> (plan
/// Section 5.2 step 4) - deliberately without Direct's own subscription-credential-kind
/// classification event, the same simplification <see cref="Adding.AddOpenAIProvider"/> makes and
/// for the same reason (plan Section 5.6, not yet ported).
/// </summary>
/// <param name="Provider">The provider to reconfigure.</param>
/// <param name="ApiKey">The new API key - blank keeps the current one.</param>
[Command]
public record ReconfigureOpenAIProvider(AIProviderId Provider, AIProviderApiKey ApiKey)
{
    /// <summary>
    /// Handles the command by appending an <see cref="OpenAIProviderReconfigured"/> event.
    /// </summary>
    /// <param name="current">The provider as configured so far - <see langword="null"/> when there is none.</param>
    /// <param name="protector">The <see cref="ISecretProtector"/> a newly supplied key is protected through.</param>
    /// <returns>The event, or a validation error when the provider is not configured.</returns>
    public async Task<Result<OpenAIProviderReconfigured, ValidationResult>> Handle(ConfiguredAIProvider? current, ISecretProtector protector)
    {
        if (current is null)
        {
            return ValidationResult.Error("The provider is not configured");
        }

        return new OpenAIProviderReconfigured(
            ApiKey.Equals(AIProviderApiKey.NotSet) ? current.ApiKey : (AIProviderApiKey)await protector.Protect(ApiKey));
    }
}

/// <summary>
/// Event raised when an OpenAI provider's API key has been changed.
/// </summary>
/// <param name="ApiKey">The new API key, protected at rest.</param>
[EventType(EventTypeId)]
public record OpenAIProviderReconfigured(AIProviderApiKey ApiKey)
{
    /// <summary>
    /// The pinned <see cref="EventTypeAttribute"/> id for this event type - chosen once, here, and
    /// never changed (decision 0002). Deliberately <em>not</em> matching Direct's own
    /// `OpenAIProviderReconfigured` the way every other sibling in this PR matches its donor
    /// (decision 0008) - see <see cref="Adding.AddOpenAIProvider"/>'s own remarks for why: Direct
    /// keeps its own OpenAI commands for now, so the two remain genuinely different event types with
    /// a coincidentally identical name.
    /// </summary>
    public const string EventTypeId = "8f1e7885-599a-4c47-9d8c-663479830b06";
}
