// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.UsageReporting.for_AIProviderUsage.when_getting_all_provider_usage;

public class and_multiple_providers_have_usage : given.all_dependencies
{
    void Establish()
    {
        // Two sessions inside the trailing week and eight older ones, so the week total and the
        // all-time total are different numbers and a spec can tell them apart.
        RecordSession(_providerOne, 150, daysAgo: 1);
        RecordSession(_providerOne, 150, daysAgo: 2);
        for (var i = 0; i < 8; i++)
        {
            RecordSession(_providerOne, 87, daysAgo: 30 + i);
        }

        for (var i = 0; i < 5; i++)
        {
            RecordSession(_providerTwo, 1_000, daysAgo: 1);
        }
    }

    async Task Because() => _result = await AIProviderUsage.AllAIProviderUsage(_sessions, _timeProvider);

    [Fact] void should_yield_both_providers() => _result.Count().ShouldEqual(2);

    [Fact]
    void should_put_the_heaviest_provider_first() =>
        _result.First().ProviderId.ShouldEqual(_providerTwo);

    [Fact]
    void should_total_the_trailing_week_for_the_busiest_provider() =>
        _result.First().TokensUsedLastWeek.ShouldEqual(5_000L);

    [Fact]
    void should_count_only_the_trailing_week_sessions_for_the_other_provider() =>
        _result.Last().JobsLastWeek.ShouldEqual(2);

    [Fact]
    void should_count_every_session_over_all_time_for_the_other_provider() =>
        _result.Last().JobsTotal.ShouldEqual(10);

    [Fact]
    void should_leave_older_sessions_out_of_the_trailing_week_total() =>
        _result.Last().TokensUsedLastWeek.ShouldEqual(300L);

    [Fact]
    void should_include_older_sessions_in_the_all_time_total() =>
        _result.Last().TokensUsedTotal.ShouldEqual(996L);
}
