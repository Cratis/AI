// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.for_ProviderConcurrencyGate.when_entering;

/// <summary>
/// Two configured providers must never share one gate - an idle provider must not queue behind a
/// busy, unrelated one the way a single global semaphore would. Each provider id gets its own
/// independent slot pool.
/// </summary>
public class and_a_different_provider_is_saturated : Specification
{
    static readonly AIProviderId _busy = AIProviderId.New();
    static readonly AIProviderId _idle = AIProviderId.New();

    IProviderConcurrencyGate _gate;
    IDisposable _busySlot;
    IDisposable? _idleSlot;

    async Task Establish()
    {
        _gate = new ProviderConcurrencyGate(Options.Create(new AIProviderOptions { MaxConcurrency = 1, MaxConcurrencyWaitTimeout = TimeSpan.FromSeconds(10) }));
        _busySlot = (await _gate.TryEnter(_busy, CancellationToken.None))!;
    }

    async Task Because() => _idleSlot = await _gate.TryEnter(_idle, CancellationToken.None).WaitAsync(TimeSpan.FromSeconds(5));

    [Fact] void should_let_the_idle_provider_in_immediately() => _idleSlot.ShouldNotBeNull();

    void Destroy()
    {
        _busySlot?.Dispose();
        _idleSlot?.Dispose();
    }
}
