// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.UsageReporting;
using Cratis.AI.Providers.UsageReporting.RecordingSnapshot;

namespace Cratis.AI.Providers.UsageReporting.for_ProviderUsageLevels.when_refreshing_many;

/// <summary>
/// A provider refreshed within its freshness window answers from the cache rather than asking the
/// vendor again - the whole reason a burst of tasks against the same pool does not each spend an
/// Admin API call rediscovering the same numbers (issue #1061).
/// </summary>
public class and_a_provider_is_freshly_cached : given.all_dependencies
{
    static readonly AIProviderId _provider = AIProviderId.New();
    static readonly ProviderUsageLevel _cached = new(AIUsageReportAvailability.Available, 1_000, false, null);

    IReadOnlyDictionary<AIProviderId, ProviderUsageLevel> _result;

    void Establish() =>
        _recentSnapshots.Get(_provider, Arg.Any<TimeSpan>()).Returns(_cached);

    async Task Because() => _result = await _levels.RefreshMany([_provider]);

    [Fact] void should_answer_with_the_cached_level() => _result[_provider].ShouldEqual(_cached);
    [Fact] void should_not_have_asked_the_vendor() => _usageReporting.DidNotReceiveWithAnyArgs().ForMany(default!, default);

    [Fact]
    async Task should_not_have_recorded_a_new_snapshot() =>
        await _commandPipeline.DidNotReceive().Execute(Arg.Any<RecordAIProviderUsageSnapshot>());
}
