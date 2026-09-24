// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Providers.OpenAI;
using Cratis.Monads;

namespace Cratis.AI.Providers.Reconfiguring;

/// <summary>
/// Command for changing an OpenAI provider's API key - a blank value keeps whatever is already
/// recorded.
/// </summary>
/// <param name="Provider">The provider to reconfigure.</param>
/// <param name="ApiKey">The new API key - blank keeps the current one.</param>
[Command]
public record ReconfigureOpenAIProvider(AIProviderId Provider, AIProviderApiKey ApiKey)
{
    /// <summary>
    /// Handles the command by appending an <see cref="OpenAIProviderReconfigured"/> event, and what
    /// kind of credential it was given.
    /// </summary>
    /// <param name="current">The provider as configured so far - <see langword="null"/> when there is none.</param>
    /// <returns>The events, or a validation error when the provider is not configured.</returns>
    /// <remarks>
    /// An OpenAI provider can be authenticated either by an API key or by a ChatGPT subscription
    /// record, and the two are spent differently - a subscription carries an expiry and has to be
    /// refreshed before it is used. Recording which kind arrived is what lets the rest of the system
    /// tell them apart later without re-parsing the credential.
    /// </remarks>
    public Result<IEnumerable<object>, ValidationResult> Handle(ConfiguredAIProvider? current)
    {
        if (current is null)
        {
            return ValidationResult.Error("The provider is not configured");
        }

        // A blank key means "leave the credential alone", so there is no new credential kind to
        // record either - re-deriving it from the untouched key would say nothing new.
        if (ApiKey.Equals(AIProviderApiKey.NotSet))
        {
            return Result<IEnumerable<object>, ValidationResult>.Success([new OpenAIProviderReconfigured(current.ApiKey)]);
        }

        return Result<IEnumerable<object>, ValidationResult>.Success(
        [
            new OpenAIProviderReconfigured(ApiKey),
            OpenAICredentialKind.EventFor(ApiKey)
        ]);
    }
}

/// <summary>
/// Refuses a ChatGPT subscription record that is not complete enough to be spent.
/// </summary>
public class ReconfigureOpenAIProviderValidator : CommandValidator<ReconfigureOpenAIProvider>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ReconfigureOpenAIProviderValidator"/> class.
    /// </summary>
    public ReconfigureOpenAIProviderValidator() =>
        RuleFor(_ => _.ApiKey)
            .Must(BeAUsableCredential)
            .WithMessage(
                "That looks like a ChatGPT subscription record but is missing something needed - it must be the " +
                "whole \"openai-codex\" object from the agent's auth file, with type, access, refresh and expires.");

    // A subscription record is judged as a whole or not at all: an ordinary API key is not JSON, so
    // it must not be held to the shape a subscription record has to have.
    static bool BeAUsableCredential(string apiKey) =>
        !OpenAICredential.IsSubscriptionCredential(apiKey) || OpenAICredential.IsUsableSubscriptionCredential(apiKey);
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
