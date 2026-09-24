// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.DependencyInjection;
using Microsoft.Extensions.Logging;

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
/// <param name="commandPipeline">Records the credential and the outcome.</param>
/// <param name="logger">The logger.</param>
[Singleton]
public class CopilotSignIns(
    ICopilotDeviceTokens tokens,
    ICommandPipeline commandPipeline,
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
        _ = Task.Run(() => WaitForAuthorization(provider, authorization));

        return new(authorization.UserCode, authorization.VerificationUrl, authorization.ExpiresAt);
    }

    async Task WaitForAuthorization(AIProviderId provider, CopilotDeviceAuthorization authorization)
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
                    await commandPipeline.ExecuteAndReport(new ReconfigureCopilotProvider(provider, credential), logger);
                    await commandPipeline.ExecuteAndReport(new EndCopilotSignIn(provider, true, string.Empty), logger);
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
                await commandPipeline.ExecuteAndReport(new EndCopilotSignIn(provider, false, result.Failure), logger);
                return;
            }

            logger.SignInExpired(provider);
            await commandPipeline.ExecuteAndReport(
                new EndCopilotSignIn(provider, false, "Nobody authorized the sign-in before the code expired. Start another one."),
                logger);
        }
        catch (Exception exception)
        {
            logger.SignInFailed(provider, exception);
            await commandPipeline.ExecuteAndReport(
                new EndCopilotSignIn(provider, false, "The sign-in could not be completed. Start another one."),
                logger);
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
