// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.for_ProviderConcurrencyGate.when_entering;

/// <summary>
/// A caller must not wait forever for a saturated provider - past the configured wait timeout the
/// gate gives up and reports no slot, so a resolution layer built on it can treat that as any other
/// resolution failure rather than hang the caller, which is often a reactor with its own timeout.
/// </summary>
public class and_the_wait_exceeds_the_configured_timeout : Specification
{
    static readonly AIProviderId _provider = AIProviderId.New();

    IProviderConcurrencyGate _gate;
    IDisposable _held;
    IDisposable? _result;

    async Task Establish()
    {
        // A genuinely short timeout - this exercises the real timeout mechanism rather than standing
        // in for a completion signal, so a small real wait is the correct way to prove it fires.
        _gate = new ProviderConcurrencyGate(Options.Create(new AIProviderOptions { MaxConcurrency = 1, MaxConcurrencyWaitTimeout = TimeSpan.FromMilliseconds(20) }));
        _held = (await _gate.TryEnter(_provider, CancellationToken.None))!;
    }

    async Task Because() => _result = await _gate.TryEnter(_provider, CancellationToken.None).WaitAsync(TimeSpan.FromSeconds(5));

    [Fact] void should_return_no_slot() => _result.ShouldBeNull();

    void Destroy() => _held?.Dispose();
}
