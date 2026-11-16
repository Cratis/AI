// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Providers.SigningIn;
using Cratis.Arc.Tenancy;
using Cratis.Chronicle;
using Cratis.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.Copilot;

/// <summary>
/// Runs the device sign-in for a Copilot provider: asks GitHub for a code, then waits for somebody
/// to authorize it and records the credential that comes back.
/// </summary>
public interface ICopilotSignIns
{
    /// <summary>
    /// Begins a sign-in and starts waiting for it to be authorized.
    /// </summary>
    /// <param name="provider">The provider being signed in.</param>
    /// <returns>What to show the person, or <see langword="null"/> when GitHub would not start one.</returns>
    Task<CopilotSignInStarted?> Begin(AIProviderId provider);
}

/// <summary>
/// The default <see cref="ICopilotSignIns"/>.
/// <para>
/// The waiting happens on a detached task rather than in the command or in a reactor, for the reason
/// <c>OpenAISubscriptionSignIns</c> spells out: a command cannot block for the minutes a person may
/// take to find their browser, and a reactor must not - Chronicle runs an observer's handlers one at
/// a time, so a reactor in a polling loop would stall every other event behind it.
/// </para>
/// <para>
/// The same consequence applies, stated rather than hidden: an in-flight sign-in lives only in this
/// process. A deployment or restart mid-authorization loses the wait and the pending sign-in expires
/// on its own; the person starts another. That is a fair trade for not introducing a durable job
/// just to hold a code somebody is about to type in.
/// </para>
/// </summary>
/// <param name="tokens">Talks to GitHub's device endpoints.</param>
/// <param name="client">Records events independently of the originating request.</param>
/// <param name="options">The configured event store.</param>
/// <param name="tenants">The tenant to capture before detaching.</param>
/// <param name="logger">The logger.</param>
[Singleton]
public class CopilotSignIns(
    ICopilotDeviceTokens tokens,
    IChronicleClient client,
    IOptions<ChronicleClientOptions> options,
    ITenantIdAccessor tenants,
    ILogger<CopilotSignIns> logger) : ICopilotSignIns
{
    /// <inheritdoc/>
    public async Task<CopilotSignInStarted?> Begin(AIProviderId provider)
    {
        var authorization = await tokens.Begin();
        if (authorization is null)
        {
            return null;
        }

        logger.SignInStarted(provider);

        // Detached deliberately - see the class remarks. Exceptions are caught inside rather than
        // left to fault an unobserved task.
        var target = new SignInRecordingTarget(options.Value.EventStore, tenants.Current);
        using (ExecutionContext.SuppressFlow())
        {
            _ = Task.Run(() => WaitForAuthorization(provider, authorization, target));
        }

        return new(authorization.UserCode, authorization.VerificationUrl, authorization.ExpiresAt);
    }

    async Task WaitForAuthorization(AIProviderId provider, CopilotDeviceAuthorization authorization, SignInRecordingTarget target)
    {
        try
        {
            var interval = TimeSpan.FromSeconds(authorization.IntervalSeconds);

            // The first wait also lets the command's own CopilotSignInStarted event land before
            // anything could try to end the sign-in it describes.
            while (DateTimeOffset.UtcNow < authorization.ExpiresAt)
            {
                await Task.Delay(interval);

                var result = await tokens.Complete(authorization);
                if (result.SlowDown)
                {
                    // GitHub's own instruction, and not optional: keep polling at the old rate after
                    // it and the flow is refused outright. Its documented correction is five seconds.
                    interval += TimeSpan.FromSeconds(5);
                    continue;
                }

                if (result.Credential is { } credential)
                {
                    await RecordCredential(target, provider, credential);
                    await Record(target, new EndCopilotSignIn(provider, true, string.Empty));
                    logger.SignInCompleted(provider);
                    return;
                }

                if (result.Pending)
                {
                    continue;
                }

                // A sign-in GitHub has already ended - declined, or a misconfigured OAuth app. Ended
                // here rather than left to expire, so the reason reaches the person while they are
                // still looking at the row that shows it.
                logger.SignInRefused(provider, result.Failure);
                await Record(target, new EndCopilotSignIn(provider, false, result.Failure));
                return;
            }

            logger.SignInExpired(provider);
            await Record(target, new EndCopilotSignIn(provider, false, "Nobody authorized the sign-in before the code expired. Start another one."));
        }
        catch (Exception exception)
        {
            logger.SignInFailed(provider, exception);
            await Record(target, new EndCopilotSignIn(provider, false, "The sign-in could not be completed. Start another one."));
        }
    }

    async Task RecordCredential(SignInRecordingTarget target, AIProviderId provider, AIProviderApiKey credential)
    {
        var store = await target.GetEventStore(client);
        var current = await store.ReadModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)provider);
        var result = new ReconfigureCopilotProvider(provider, credential).Handle(current);
        if (result.TryGetResult(out var connected))
        {
            var appended = await store.EventLog.Append((EventSourceId)provider, connected);
            Report(appended.ToCommandResult(), nameof(ReconfigureCopilotProvider));
        }
        else if (result.TryGetError(out var error))
        {
            logger.CommandNotSuccessful(nameof(ReconfigureCopilotProvider), nameof(WaitForAuthorization), error.Message);
        }
    }

    async Task Record(SignInRecordingTarget target, EndCopilotSignIn command)
    {
        var store = await target.GetEventStore(client);
        var result = await store.EventLog.Append(command.GetEventSourceId(), command.Handle());
        Report(result.ToCommandResult(), nameof(EndCopilotSignIn));
    }

    void Report(CommandResult result, string command)
    {
        if (!result.IsSuccess)
        {
            logger.CommandNotSuccessful(command, nameof(WaitForAuthorization), result.Describe());
        }
    }
}

/// <summary>
/// Log messages for a Copilot device sign-in.
/// </summary>
internal static partial class CopilotSignInsLog
{
    [LoggerMessage(LogLevel.Information, "Started a GitHub Copilot sign-in for provider {Provider}")]
    internal static partial void SignInStarted(this ILogger logger, AIProviderId provider);

    [LoggerMessage(LogLevel.Information, "A GitHub Copilot sign-in completed for provider {Provider}")]
    internal static partial void SignInCompleted(this ILogger logger, AIProviderId provider);

    [LoggerMessage(LogLevel.Information, "A GitHub Copilot sign-in for provider {Provider} expired before anyone authorized it")]
    internal static partial void SignInExpired(this ILogger logger, AIProviderId provider);

    [LoggerMessage(LogLevel.Warning, "A GitHub Copilot sign-in for provider {Provider} ended without a credential: {Reason}")]
    internal static partial void SignInRefused(this ILogger logger, AIProviderId provider, string reason);

    [LoggerMessage(LogLevel.Warning, "A GitHub Copilot sign-in for provider {Provider} could not be completed")]
    internal static partial void SignInFailed(this ILogger logger, AIProviderId provider, Exception exception);
}
