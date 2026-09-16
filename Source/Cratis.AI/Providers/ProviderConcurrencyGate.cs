// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Collections.Concurrent;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers;

/// <summary>
/// Bounds how many calls to one configured AI provider may be in flight at once, independently per
/// <see cref="AIProviderId"/> - the one choke point every dispatch, direct or via a pool member
/// (once pools exist - plan Section 5.2 step 5), is meant to pass through around the actual vendor
/// call. Ported from Direct's <c>AIProviders.IProviderConcurrencyGate</c>/<c>ProviderConcurrencyGate</c>
/// (plan Section 5.2 step 6).
/// </summary>
/// <remarks>
/// Deliberately not one shared gate: two configured providers can have unrelated rate limits, and a
/// global gate would throttle an idle provider purely because a busy, unrelated one is saturated.
/// </remarks>
public interface IProviderConcurrencyGate
{
    /// <summary>
    /// Waits for a slot to become free for the given provider, up to
    /// <see cref="AIProviderOptions.MaxConcurrencyWaitTimeout"/>.
    /// </summary>
    /// <param name="providerId">The provider to bound concurrency for.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the wait.</param>
    /// <returns>An <see cref="IDisposable"/> that releases the slot when disposed, or <see langword="null"/> when no slot freed up within the configured wait timeout.</returns>
    Task<IDisposable?> TryEnter(AIProviderId providerId, CancellationToken cancellationToken);
}

/// <summary>
/// Represents an implementation of <see cref="IProviderConcurrencyGate"/> keeping one
/// <see cref="SemaphoreSlim"/> per provider, created lazily on first use and sized from
/// <see cref="AIProviderOptions.MaxConcurrency"/> at that moment. Register as a singleton: the
/// semaphores it holds have to be shared across every completion in flight for a provider, or the
/// limit means nothing.
/// </summary>
/// <param name="options">The AI provider configuration.</param>
public sealed class ProviderConcurrencyGate(IOptions<AIProviderOptions> options) : IProviderConcurrencyGate, IDisposable
{
    readonly ConcurrentDictionary<AIProviderId, SemaphoreSlim> _semaphores = new();

    /// <inheritdoc/>
    public async Task<IDisposable?> TryEnter(AIProviderId providerId, CancellationToken cancellationToken)
    {
        var semaphore = _semaphores.GetOrAdd(providerId, static (_, maxConcurrency) => new SemaphoreSlim(Math.Max(1, maxConcurrency)), options.Value.MaxConcurrency);
        var acquired = await semaphore.WaitAsync(options.Value.MaxConcurrencyWaitTimeout, cancellationToken);
        return acquired ? new Slot(semaphore) : null;
    }

    /// <inheritdoc/>
    public void Dispose()
    {
        foreach (var semaphore in _semaphores.Values)
        {
            semaphore.Dispose();
        }
    }

    sealed class Slot(SemaphoreSlim semaphore) : IDisposable
    {
        public void Dispose() => semaphore.Release();
    }
}
