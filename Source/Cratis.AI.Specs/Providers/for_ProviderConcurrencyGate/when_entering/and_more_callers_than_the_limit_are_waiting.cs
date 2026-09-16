// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.for_ProviderConcurrencyGate.when_entering;

/// <summary>
/// The whole point of the gate: a provider sized at N concurrent calls makes the (N+1)th caller wait
/// for a slot instead of dispatching unbounded. Proven without any real sleep - the first N slots are
/// held open deliberately, and the (N+1)th caller's task is observed to complete only after one of
/// them is released.
/// </summary>
public class and_more_callers_than_the_limit_are_waiting : Specification
{
    static readonly AIProviderId _provider = AIProviderId.New();

    IProviderConcurrencyGate _gate;
    IDisposable _first;
    IDisposable _second;
    Task<IDisposable?> _thirdCaller;

    async Task Establish()
    {
        _gate = new ProviderConcurrencyGate(Options.Create(new AIProviderOptions { MaxConcurrency = 2, MaxConcurrencyWaitTimeout = TimeSpan.FromSeconds(10) }));
        _first = (await _gate.TryEnter(_provider, CancellationToken.None))!;
        _second = (await _gate.TryEnter(_provider, CancellationToken.None))!;
    }

    async Task Because()
    {
        _thirdCaller = _gate.TryEnter(_provider, CancellationToken.None);

        // Widens the interleaving window so the third caller has genuinely started waiting on the
        // semaphore before the fact below asserts it has not completed yet - not a wait for a result.
        await Task.Delay(1);
    }

    [Fact]
    async Task should_wait_for_a_slot_and_proceed_once_one_is_released()
    {
        _thirdCaller.IsCompleted.ShouldBeFalse();

        _first.Dispose();

        var slot = await _thirdCaller.WaitAsync(TimeSpan.FromSeconds(5));

        slot.ShouldNotBeNull();
        slot!.Dispose();
    }

    void Destroy() => _second?.Dispose();
}
