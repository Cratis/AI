// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Providers.OpenAI;
using Cratis.AI.Providers.Refreshing;
using Cratis.Arc.Tenancy;
using Cratis.Chronicle;
using Cratis.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.SigningIn;

/// <summary>
/// Runs the device-code sign-in for a provider: asks OpenAI for a code, then waits for somebody to
/// authorize it and records the credential that comes back.
/// </summary>
public interface IOpenAISubscriptionSignIns
{
    /// <summary>
    /// Begins a sign-in and starts waiting for it to be authorized.
    /// </summary>
    /// <param name="provider">The provider being signed in.</param>
    /// <returns>What to show the person, or <see langword="null"/> when OpenAI would not start one.</returns>
    Task<OpenAISubscriptionSignInStarted?> Begin(AIProviderId provider);
}

/// <summary>
/// The default <see cref="IOpenAISubscriptionSignIns"/>.
/// <para>
/// The waiting happens on a detached task rather than in the command or in a reactor. A command
/// cannot block for the fifteen minutes a person may take to find their browser, and a reactor must
/// not: Chronicle runs an observer's handlers one at a time, so a reactor sitting in a polling loop
/// would stall every other event behind it.
/// </para>
/// <para>
/// The consequence, stated rather than hidden: an in-flight sign-in lives only in this process. A
/// deployment or restart while somebody is mid-authorization loses the wait, and the pending sign-in
/// is left to expire on its own - the person starts another one. That is a fair trade for not
/// introducing a durable job just to hold a code somebody is about to type in.
/// </para>
/// </summary>
/// <param name="tokens">Talks to OpenAI's device-code endpoints.</param>
/// <param name="client">Records events independently of the originating request.</param>
/// <param name="options">The configured event store.</param>
/// <param name="tenants">The tenant to capture before detaching.</param>
/// <param name="logger">The logger.</param>
[Singleton]
public class OpenAISubscriptionSignIns(
    IOpenAISubscriptionTokens tokens,
    IChronicleClient client,
    IOptions<ChronicleClientOptions> options,
    ITenantIdAccessor tenants,
    ILogger<OpenAISubscriptionSignIns> logger) : IOpenAISubscriptionSignIns
{
    /// <summary>
    /// How long OpenAI keeps a user code alive - matching the CLI's own ceiling.
    /// </summary>
    static readonly TimeSpan _codeLifetime = TimeSpan.FromMinutes(15);

    /// <inheritdoc/>
    public async Task<OpenAISubscriptionSignInStarted?> Begin(AIProviderId provider)
    {
        var authorization = await tokens.BeginDeviceSignIn();
        if (authorization is null)
        {
            return null;
        }

        var expiresAt = DateTimeOffset.UtcNow.Add(_codeLifetime);
        logger.SignInStarted(provider);

        // Detached deliberately - see the class remarks. Exceptions are caught inside rather than
        // left to fault an unobserved task.
        var target = new SignInRecordingTarget(options.Value.EventStore, tenants.Current);
        using (ExecutionContext.SuppressFlow())
        {
            _ = Task.Run(() => WaitForAuthorization(provider, authorization, expiresAt, target));
        }

        return new(authorization.UserCode, OpenAISubscriptionTokens.VerificationUrl, expiresAt);
    }

    async Task WaitForAuthorization(AIProviderId provider, OpenAIDeviceAuthorization authorization, DateTimeOffset expiresAt, SignInRecordingTarget target)
    {
        try
        {
            var interval = TimeSpan.FromSeconds(authorization.IntervalSeconds);

            // The first wait also lets the command's own OpenAISubscriptionSignInStarted event land
            // before anything could try to end the sign-in it describes.
            while (DateTimeOffset.UtcNow < expiresAt)
            {
                await Task.Delay(interval);

                var credential = await tokens.CompleteDeviceSignIn(authorization);
                if (credential is null)
                {
                    continue;
                }

                // Share the rotation handler's validation and events without entering a command pipeline.
                await RecordCredential(target, provider, credential.ToApiKey());
                await Record(target, new EndOpenAISubscriptionSignIn(provider, true, string.Empty));
                logger.SignInCompleted(provider);
                return;
            }

            logger.SignInExpired(provider);
            await Record(target, new EndOpenAISubscriptionSignIn(
                provider,
                false,
                "Nobody authorized the sign-in before the code expired. Start another one."));
        }
        catch (Exception exception)
        {
            logger.SignInFailed(provider, exception);
            await Record(target, new EndOpenAISubscriptionSignIn(
                provider,
                false,
                "The sign-in could not be completed. Start another one."));
        }
    }

    async Task RecordCredential(SignInRecordingTarget target, AIProviderId provider, AIProviderApiKey credential)
    {
        var store = await target.GetEventStore(client);
        var current = await store.ReadModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)provider);
        var result = new RecordRefreshedOpenAISubscription(provider, credential).Handle(current);
        if (result.TryGetResult(out var events))
        {
            var appended = await store.EventLog.AppendMany((EventSourceId)provider, events);
            Report(appended.ToCommandResult(), nameof(RecordRefreshedOpenAISubscription));
        }
        else if (result.TryGetError(out var error))
        {
            logger.CommandNotSuccessful(nameof(RecordRefreshedOpenAISubscription), nameof(WaitForAuthorization), error.Message);
        }
    }

    async Task Record(SignInRecordingTarget target, EndOpenAISubscriptionSignIn command)
    {
        var store = await target.GetEventStore(client);
        var result = await store.EventLog.Append(command.GetEventSourceId(), command.Handle());
        Report(result.ToCommandResult(), nameof(EndOpenAISubscriptionSignIn));
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
/// Log messages for a device-code sign-in - it runs detached, so this is the only trace it leaves.
/// </summary>
internal static partial class OpenAISubscriptionSignInsLog
{
    [LoggerMessage(LogLevel.Information, "Started a ChatGPT subscription sign-in for provider {Provider}")]
    internal static partial void SignInStarted(this ILogger logger, AIProviderId provider);

    [LoggerMessage(LogLevel.Information, "A ChatGPT subscription sign-in completed for provider {Provider}")]
    internal static partial void SignInCompleted(this ILogger logger, AIProviderId provider);

    [LoggerMessage(LogLevel.Information, "A ChatGPT subscription sign-in for provider {Provider} expired before anyone authorized it")]
    internal static partial void SignInExpired(this ILogger logger, AIProviderId provider);

    [LoggerMessage(LogLevel.Warning, "A ChatGPT subscription sign-in for provider {Provider} could not be completed")]
    internal static partial void SignInFailed(this ILogger logger, AIProviderId provider, Exception exception);
}
