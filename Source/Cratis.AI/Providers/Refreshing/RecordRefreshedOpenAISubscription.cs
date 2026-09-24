// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.OpenAI;
using Cratis.Monads;
namespace Cratis.AI.Providers.Refreshing;

/// <summary>
/// Command for recording that a ChatGPT subscription credential has been rotated.
/// <para>
/// This is not a person reconfiguring a provider, which is why it is its own command and its own
/// event rather than reusing <c>ReconfigureOpenAIProvider</c>: it is the system keeping a credential
/// that rotates on every use current, and the log should read that way. It also has no
/// blank-keeps-existing behavior - a refresh either produced a new credential or it did not happen.
/// </para>
/// <para>
/// Recording it is not optional bookkeeping. OpenAI retires a refresh token the moment it is spent,
/// so the credential Direct holds after an exchange is the <b>only</b> live one; failing to store
/// it back would leave the provider authenticating with a token the vendor has already discarded,
/// which fails on the next dispatch with nothing to point at.
/// </para>
/// </summary>
/// <param name="Provider">The provider whose credential was rotated.</param>
/// <param name="Credential">The freshly minted credential, unprotected - protected here before it lands on the event.</param>
[Command]
public record RecordRefreshedOpenAISubscription(AIProviderId Provider, AIProviderApiKey Credential)
{
    /// <summary>
    /// Handles the command by appending an <see cref="OpenAISubscriptionCredentialRefreshed"/> event.
    /// </summary>
    /// <param name="current">The provider as configured so far - <see langword="null"/> when there is none.</param>
    /// <returns>The events, or a validation error when the provider is not configured.</returns>
    /// <remarks>
    /// The rotation also restates when the credential now expires, so the operator-facing listing
    /// tracks the live one rather than the expiry of whatever was originally pasted in.
    /// </remarks>
    public Result<IEnumerable<object>, ValidationResult> Handle(ConfiguredAIProvider? current)
    {
        if (current is null)
        {
            return ValidationResult.Error("The provider is not configured");
        }

        return Result<IEnumerable<object>, ValidationResult>.Success(
        [
            new OpenAISubscriptionCredentialRefreshed(Credential),
            OpenAICredentialKind.EventFor(Credential)
        ]);
    }
}

/// <summary>
/// Event raised when a ChatGPT subscription credential has been exchanged for a fresh one, retiring
/// the refresh token it was minted from.
/// </summary>
/// <param name="ApiKey">The refreshed credential, protected at rest.</param>
[EventType]
public record OpenAISubscriptionCredentialRefreshed(AIProviderApiKey ApiKey);
