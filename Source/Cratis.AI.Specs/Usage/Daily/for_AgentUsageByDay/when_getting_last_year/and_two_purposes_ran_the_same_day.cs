// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using NSubstitute;

namespace Cratis.AI.Usage.Daily.for_AgentUsageByDay.when_getting_last_year;

/// <summary>
/// What answers "how much CPU/memory went to investigation versus planning versus implementation for
/// an agent" (Cratis/AI#337's follow-up request): <see cref="AgentUsageByDay.LastYear"/> already
/// buckets by <see cref="LanguageModelPurpose"/> - this proves CPU/memory ride along in that same
/// bucketing rather than only being visible as an undifferentiated weekly/monthly total.
/// </summary>
public class and_two_purposes_ran_the_same_day : Specification
{
    static readonly DateTimeOffset _now = new(2026, 1, 8, 12, 0, 0, TimeSpan.Zero);
    static readonly AgentId _agent = new("wright");

    IEnumerable<AgentUsageByDay> _result;

    async Task Because()
    {
        var sessions = Substitute.For<IRecordedAgentSessions>();
        sessions.RecordedSince(Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>()).Returns(
        [
            new RecordedAgentSession(_now, null, _agent, new LanguageModelPurpose("Investigation"), new ModelName("sonnet"), 100, 50, 0.01m, 1000, CpuSeconds: 12m, MemoryBytes: 1024),
            new RecordedAgentSession(_now, null, _agent, new LanguageModelPurpose("Investigation"), new ModelName("sonnet"), 100, 50, 0.01m, 1000, CpuSeconds: 8m, MemoryBytes: 512),
            new RecordedAgentSession(_now, null, _agent, new LanguageModelPurpose("Implementation"), new ModelName("sonnet"), 100, 50, 0.01m, 1000, CpuSeconds: 100m, MemoryBytes: 4096),
        ]);

        var timeProvider = Substitute.For<TimeProvider>();
        timeProvider.GetUtcNow().Returns(_now);

        _result = await AgentUsageByDay.LastYear(sessions, timeProvider);
    }

    [Fact] void should_produce_one_row_per_purpose() => _result.Count().ShouldEqual(2);

    [Fact]
    void should_sum_investigations_cpu_separately_from_implementations() =>
        _result.Single(row => row.Purpose.Value == "Investigation").CpuSeconds.ShouldEqual(20m);

    [Fact]
    void should_not_mix_implementations_cpu_into_investigations() =>
        _result.Single(row => row.Purpose.Value == "Implementation").CpuSeconds.ShouldEqual(100m);

    [Fact]
    void should_sum_investigations_memory_separately() =>
        _result.Single(row => row.Purpose.Value == "Investigation").MemoryBytes.ShouldEqual(1536L);
}
