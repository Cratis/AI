// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Monads;

namespace Cratis.AI.Providers.Copilot;

/// <summary>
/// Command for signing a Copilot provider in to a GitHub account, using GitHub's device flow.
/// <para>
/// The same reasoning <c>StartOpenAISubscriptionSignIn</c> is built on applies here: nobody should
/// have to mint a token somewhere else and paste it into a field labelled "API key" to connect a
/// subscription. Device flow is the flow designed for this - the server has no browser, so a person
/// authorizes from any browser they do have. Pasting a token stays available for deployments with no
/// OAuth app of their own (<see cref="ReconfigureCopilotProvider"/>), but it is not the front door.
/// </para>
/// </summary>
/// <param name="Provider">The provider being signed in.</param>
[Command]
public record StartCopilotSignIn(AIProviderId Provider) : ICanProvideEventSourceId
{
    /// <inheritdoc/>
    public EventSourceId GetEventSourceId() => (EventSourceId)Provider;

    /// <summary>
    /// Handles the command by asking GitHub for a user code and recording that a sign-in is waiting
    /// on somebody.
    /// </summary>
    /// <param name="current">The provider being signed in - <see langword="null"/> when there is none.</param>
    /// <param name="signIns">Runs the device flow.</param>
    /// <returns>The event, or a validation error.</returns>
    public async Task<Result<CopilotSignInStarted, ValidationResult>> Handle(ConfiguredAIProvider? current, ICopilotSignIns signIns)
    {
        if (current is null)
        {
            return ValidationResult.Error("The provider is not configured");
        }

        if (current.Type != AIProviderType.Copilot)
        {
            return ValidationResult.Error("Only a Copilot provider can be signed in to a GitHub account");
        }

        // Two different failures read differently on purpose: a missing OAuth app is a
        // misconfiguration somebody has to go and fix, while GitHub declining to start a flow is
        // transient and reads as "try again".
        Result<CopilotSignInStarted, ValidationResult> declined = ValidationResult.Error(
            "GitHub would not start a sign-in just now. If this keeps happening, check that Direct:Copilot:ClientId names an OAuth app with device flow enabled.");

        return await signIns.Begin(Provider) is { } started ? started : declined;
    }
}

/// <summary>
/// Command for ending a Copilot sign-in, however it turned out.
/// </summary>
/// <param name="Provider">The provider whose sign-in ended.</param>
/// <param name="Succeeded">Whether the person authorized it.</param>
/// <param name="Reason">Why it did not succeed, when it did not.</param>
[Command]
public record EndCopilotSignIn(AIProviderId Provider, bool Succeeded, string Reason) : ICanProvideEventSourceId
{
    /// <inheritdoc/>
    public EventSourceId GetEventSourceId() => (EventSourceId)Provider;

    /// <summary>
    /// Handles the command by recording which way the sign-in went.
    /// </summary>
    /// <returns>The event.</returns>
    public object Handle() =>
        Succeeded
            ? new CopilotSignInCompleted()
            : new CopilotSignInFailed(Reason);
}

/// <summary>
/// Event raised when a Copilot sign-in is waiting for somebody to authorize it.
/// </summary>
/// <param name="UserCode">The code to type into GitHub's verification page. Not a secret: it is worthless without somebody signing in to their own GitHub account.</param>
/// <param name="VerificationUrl">Where to type it.</param>
/// <param name="ExpiresAt">When the code stops being accepted.</param>
[EventType]
public record CopilotSignInStarted(string UserCode, string VerificationUrl, DateTimeOffset ExpiresAt);

/// <summary>
/// Event raised when a Copilot sign-in was authorized and the credential recorded.
/// </summary>
[EventType]
public record CopilotSignInCompleted;

/// <summary>
/// Event raised when a Copilot sign-in ended without a credential - the code expired, or GitHub
/// refused it.
/// </summary>
/// <param name="Reason">What happened, in a sentence somebody can act on.</param>
[EventType]
public record CopilotSignInFailed(string Reason);
