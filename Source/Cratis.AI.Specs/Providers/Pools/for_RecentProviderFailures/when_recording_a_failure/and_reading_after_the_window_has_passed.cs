// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.for_RecentProviderFailures.when_recording_a_failure;

/// <summary>
/// A provider that stops failing is worth ranking normally again - the failure memory is a trailing
/// window, not a permanent mark.
/// </summary>
public class and_reading_after_the_window_has_passed : Specification
{
    static readonly AIProviderId _provider = AIProviderId.New();
    static readonly DateTimeOffset _now = new(2026, 8, 8, 12, 0, 0, TimeSpan.Zero);

    MutableTimeProvider _timeProvider;
    RecentProviderFailures _failures;
    IReadOnlyDictionary<AIProviderId, int> _counts;

    void Establish()
    {
        _timeProvider = new(_now);
        _failures = new(_timeProvider);
        _failures.Record(_provider);
        _timeProvider.Now = _now.AddMinutes(16);
    }

    void Because() => _counts = _failures.CountsSince(TimeSpan.FromMinutes(15));

    [Fact] void should_report_no_failures_for_the_provider() => _counts.ContainsKey(_provider).ShouldBeFalse();

    sealed class MutableTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = now;

        public override DateTimeOffset GetUtcNow() => Now;
    }
}
