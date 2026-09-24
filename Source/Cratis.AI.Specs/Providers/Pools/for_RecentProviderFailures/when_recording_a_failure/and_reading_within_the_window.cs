// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.for_RecentProviderFailures.when_recording_a_failure;

public class and_reading_within_the_window : Specification
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
        _failures.Record(_provider);
    }

    void Because() => _counts = _failures.CountsSince(TimeSpan.FromMinutes(15));

    [Fact] void should_count_both_failures() => _counts[_provider].ShouldEqual(2);

    [Fact]
    void should_report_no_failures_for_a_provider_that_never_failed() =>
        _counts.ContainsKey(AIProviderId.New()).ShouldBeFalse();

    sealed class MutableTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = now;

        public override DateTimeOffset GetUtcNow() => Now;
    }
}
