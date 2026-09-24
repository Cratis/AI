// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Reactive.Subjects;
using Cratis.Monads;
using MongoDB.Driver;

namespace Cratis.AI.Providers.SigningIn;

/// <summary>
/// Command for signing an OpenAI provider in to a ChatGPT subscription, using OpenAI's device-code
/// flow.
/// <para>
/// This exists so nobody has to copy JSON out of a file. The alternative - run <c>pi</c> somewhere,
/// open <c>~/.pi/agent/auth.json</c>, paste an object into a field labelled "API key" - is
/// undiscoverable and easy to get half right. Device-code is the flow designed for exactly this
/// situation: the server has no browser, so a person authorizes from any browser they do have.
/// </para>
/// </summary>
/// <param name="Provider">The provider being signed in.</param>
[Command]
public record StartOpenAISubscriptionSignIn(AIProviderId Provider) : ICanProvideEventSourceId
{
    /// <inheritdoc/>
    public EventSourceId GetEventSourceId() => (EventSourceId)Provider;

    /// <summary>
    /// Handles the command by asking OpenAI for a user code and recording that a sign-in is waiting
    /// on somebody.
    /// </summary>
    /// <param name="current">The provider being signed in - <see langword="null"/> when there is none.</param>
    /// <param name="signIns">Runs the device-code flow.</param>
    /// <returns>The event, or a validation error.</returns>
    public async Task<Result<OpenAISubscriptionSignInStarted, ValidationResult>> Handle(ConfiguredAIProvider? current, IOpenAISubscriptionSignIns signIns)
    {
        if (current is null)
        {
            return ValidationResult.Error("The provider is not configured");
        }

        if (current.Type is not (AIProviderType.OpenAICodex or AIProviderType.OpenAI))
        {
            return ValidationResult.Error("Only an OpenAI Codex provider can be signed in to a ChatGPT subscription");
        }

        // OpenAI occasionally declines to start one - a transient refusal rather than anything about
        // the provider - so this reads as "try again" rather than as a misconfiguration.
        Result<OpenAISubscriptionSignInStarted, ValidationResult> declined =
            ValidationResult.Error("OpenAI would not start a sign-in just now. Try again in a moment.");

        return await signIns.Begin(Provider) is { } started ? started : declined;
    }
}

/// <summary>
/// Command for ending a sign-in, however it turned out.
/// </summary>
/// <param name="Provider">The provider whose sign-in ended.</param>
/// <param name="Succeeded">Whether the person authorized it.</param>
/// <param name="Reason">Why it did not succeed, when it did not.</param>
[Command]
public record EndOpenAISubscriptionSignIn(AIProviderId Provider, bool Succeeded, string Reason) : ICanProvideEventSourceId
{
    /// <inheritdoc/>
    public EventSourceId GetEventSourceId() => (EventSourceId)Provider;

    /// <summary>
    /// Handles the command by recording which way the sign-in went.
    /// </summary>
    /// <returns>The event.</returns>
    public object Handle() =>
        Succeeded
            ? new OpenAISubscriptionSignInCompleted()
            : new OpenAISubscriptionSignInFailed(Reason);
}

/// <summary>
/// Event raised when a ChatGPT subscription sign-in is waiting for somebody to authorize it.
/// </summary>
/// <param name="UserCode">The code to type into the verification page. Not a secret: it is worthless without someone signing in to their own ChatGPT account.</param>
/// <param name="VerificationUrl">Where to type it.</param>
/// <param name="ExpiresAt">When the code stops being accepted.</param>
[EventType]
public record OpenAISubscriptionSignInStarted(string UserCode, string VerificationUrl, DateTimeOffset ExpiresAt);

/// <summary>
/// Event raised when a ChatGPT subscription sign-in was authorized and the credential recorded.
/// </summary>
[EventType]
public record OpenAISubscriptionSignInCompleted;

/// <summary>
/// Event raised when a ChatGPT subscription sign-in ended without a credential - the code expired,
/// or OpenAI refused it.
/// </summary>
/// <param name="Reason">What happened, in a sentence somebody can act on.</param>
[EventType]
public record OpenAISubscriptionSignInFailed(string Reason);

/// <summary>
/// Read model for a sign-in that is waiting on somebody - what the provider row shows the code and
/// link from. It exists only while the sign-in is outstanding: both ways it can end remove it.
/// </summary>
/// <param name="Id">The provider being signed in.</param>
/// <param name="UserCode">The code to type into the verification page.</param>
/// <param name="VerificationUrl">Where to type it.</param>
/// <param name="ExpiresAt">When the code stops being accepted.</param>
[ReadModel]
[FromEvent<OpenAISubscriptionSignInStarted>]
[RemovedWith<OpenAISubscriptionSignInCompleted>]
[RemovedWith<OpenAISubscriptionSignInFailed>]
public record PendingSubscriptionSignIn(AIProviderId Id, string UserCode, string VerificationUrl, DateTimeOffset ExpiresAt)
{
    /// <summary>
    /// Observes every sign-in currently waiting on somebody.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding them.</param>
    /// <returns>An observable of every pending sign-in.</returns>
    public static ISubject<IEnumerable<PendingSubscriptionSignIn>> PendingSubscriptionSignIns(IMongoCollection<PendingSubscriptionSignIn> collection) =>
        collection.Observe();
}
