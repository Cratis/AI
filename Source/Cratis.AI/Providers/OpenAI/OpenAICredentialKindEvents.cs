// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.OpenAI;

/// <summary>
/// Event raised when an OpenAI provider was configured with a ChatGPT subscription rather than an
/// API key.
/// <para>
/// The credential itself is on the vendor's own Added/Reconfigured event, protected at rest. This
/// one carries only what an operator needs to see without decrypting anything: that the provider is
/// on a subscription at all, and when its access token runs out. Both matter on a cluster running by
/// itself, where a credential that quietly stops working is the failure mode - and neither is
/// derivable from the client-facing listing, which deliberately holds no key.
/// </para>
/// </summary>
/// <param name="ExpiresAt">When the access token the provider currently holds expires.</param>
[EventType]
public record OpenAISubscriptionCredentialConfigured(DateTimeOffset ExpiresAt);

/// <summary>
/// Event raised when an OpenAI provider was configured with an ordinary API key.
/// </summary>
/// <remarks>
/// The counterpart to <see cref="OpenAISubscriptionCredentialConfigured"/>, and the reason the two
/// are separate facts rather than one event with a nullable expiry: a provider moved from a
/// subscription back to a key has to stop reading as a subscription, and "no longer one" is its own
/// thing that happened rather than the absence of a value.
/// </remarks>
[EventType]
public record OpenAIProviderApiKeyConfigured;

/// <summary>
/// Produces the fact that records which kind of credential an OpenAI provider was just configured
/// with, so the two commands that set one (adding and reconfiguring) say it the same way.
/// </summary>
public static class OpenAICredentialKind
{
    /// <summary>
    /// The event describing the credential's kind.
    /// </summary>
    /// <param name="apiKey">The credential as supplied, before it is protected.</param>
    /// <returns>The event.</returns>
    public static object EventFor(AIProviderApiKey apiKey) =>
        OpenAISubscriptionCredential.TryParse(apiKey) is { } subscription
            ? new OpenAISubscriptionCredentialConfigured(subscription.ExpiresAt)
            : new OpenAIProviderApiKeyConfigured();
}
