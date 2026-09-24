// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Common;
using Cratis.AI.Providers.OpenAI;
using Cratis.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.Refreshing;

/// <summary>
/// Keeps a provider's rotating subscription credential current, and records every rotation.
/// </summary>
public interface ISubscriptionCredentials
{
    /// <summary>
    /// Returns the credential a unit of work should actually be dispatched with, refreshing and
    /// recording a rotation first when the stored one is close to expiring.
    /// </summary>
    /// <param name="provider">The provider the credential belongs to.</param>
    /// <param name="revealed">The stored credential, already revealed.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The credential to dispatch with, or <see langword="null"/> when there is no usable one.</returns>
    Task<AIProviderApiKey?> EnsureCurrent(AIProviderId provider, AIProviderApiKey revealed, CancellationToken cancellationToken = default);
}

/// <summary>
/// The default <see cref="ISubscriptionCredentials"/>.
/// <para>
/// Direct refreshes a ChatGPT subscription centrally, rather than letting each worker container
/// do it, because OpenAI rotates the refresh token on every exchange and retires the one that was
/// spent. A credential handed to two containers therefore cannot survive both of them refreshing,
/// and a container that refreshes and then exits takes the only live credential with it. Doing it
/// here - once, before dispatch, with the result recorded - keeps exactly one live lineage, owned by
/// the one component that can persist it.
/// </para>
/// <para>
/// Anything that is not a subscription credential passes straight through untouched: an API key does
/// not expire and has nothing to rotate.
/// </para>
/// </summary>
/// <param name="tokens">Performs the exchange against OpenAI's token endpoint.</param>
/// <param name="commandPipeline">Records the rotation, so the credential survives this process.</param>
/// <param name="alerts">Where a credential failure that stops all work is reported.</param>
/// <param name="options">Where the refresh margin is read from.</param>
/// <param name="logger">The logger.</param>
[Singleton]
public class SubscriptionCredentials(
    IOpenAISubscriptionTokens tokens,
    ICommandPipeline commandPipeline,
    IAIAlerts alerts,
    IOptions<AIProviderOptions> options,
    ILogger<SubscriptionCredentials> logger) : ISubscriptionCredentials, IDisposable
{
    /// <summary>
    /// The system these alerts come from.
    /// </summary>

    /// <summary>
    /// Serializes refreshes, because two dispatches racing on one rotating credential would each
    /// spend a refresh token and one of them would lose. In-process is the right scope: the
    /// dispatcher is the only thing that refreshes, and it is a single scheduled pass.
    /// </summary>
    readonly SemaphoreSlim _gate = new(1, 1);

    /// <inheritdoc/>
    public async Task<AIProviderApiKey?> EnsureCurrent(AIProviderId provider, AIProviderApiKey revealed, CancellationToken cancellationToken = default)
    {
        if (!OpenAICredential.IsSubscriptionCredential(revealed))
        {
            return revealed;
        }

        await _gate.WaitAsync(cancellationToken);
        try
        {
            var credential = OpenAISubscriptionCredential.TryParse(revealed);
            if (credential is null)
            {
                logger.SubscriptionCredentialUnusable(provider);
                var unreadable = $"Provider {provider} holds a subscription credential that could not be parsed, so no work can be dispatched on it. " +
                    "Sign in again and reconfigure the provider in Settings under AI.";
                await Alert(provider, "A subscription credential cannot be read", unreadable);
                return null;
            }

            if (!credential.NeedsRefresh(options.Value.SubscriptionRefreshMargin, DateTimeOffset.UtcNow))
            {
                return revealed;
            }

            logger.RefreshingSubscriptionCredential(provider, credential.ExpiresAt);
            var refreshed = await tokens.Refresh(credential, cancellationToken);
            if (refreshed is null)
            {
                // The exchange already logged why. Answering null leaves the work scheduled rather
                // than launching a container that cannot authenticate.
                //
                // It also raises an alert, because this is the failure that ends a subscription and
                // it happens where nobody is looking - in a scheduling pass, on a cluster running by
                // itself. A log line would leave the queue quietly not moving, which is precisely the
                // shape of failure this whole path was built to avoid.
                var refused = $"OpenAI refused to refresh the subscription credential for provider {provider}, so no work can be dispatched on it. " +
                    "The stored credential has most likely been retired - signing in again elsewhere does that - and the provider needs a newly minted one from Settings under AI.";
                await Alert(provider, "A subscription credential could not be refreshed", refused);
                return null;
            }

            // Recorded before it is handed out. If this throws, the credential that was just minted
            // would otherwise be spent by a container and lost, leaving the stored one retired at the
            // vendor - the exact dead end central refreshing exists to prevent.
            var recorded = refreshed.ToApiKey();
            await commandPipeline.ExecuteAndReport(new RecordRefreshedOpenAISubscription(provider, recorded), logger);
            logger.RefreshedSubscriptionCredential(provider, refreshed.ExpiresAt);
            return recorded;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <inheritdoc/>
    public void Dispose()
    {
        _gate.Dispose();
        GC.SuppressFinalize(this);
    }

    /// <summary>
    /// Raises an alert against the provider, naming it in the detail so an operator reading the
    /// alert knows which provider stopped without going looking.
    /// </summary>
    /// <param name="provider">The provider the condition is about.</param>
    /// <param name="title">The one-line headline.</param>
    /// <param name="detail">What it means and what to do about it.</param>
    /// <returns>Awaitable task.</returns>
    Task Alert(AIProviderId provider, string title, string detail) =>
        alerts.Raise(new AIAlert(title, $"{detail} (provider {provider})", AIAlertSeverity.Error));
}
