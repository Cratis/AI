// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.AI.Providers.Capacity;
using Cratis.AI.Usage.Daily;
using Cratis.AI.Usage.Trends;
using Cratis.Json;

namespace Cratis.AI.Usage.Recording.for_RecordAgentSessionUsageWithCapacity.when_replaying;

public class a_mixed_stream : given.a_usage_boundary
{
    const string LegacyJson = """{"Session":"d71cf29d-a21b-457a-a58f-9d5f1c1b6b6d","Agent":"triage","Provider":null,"Model":"sonnet","Harness":null,"Purpose":"triage","InputTokens":120,"OutputTokens":45,"CachedTokens":10,"CostUsd":0.02,"CpuSeconds":3.5,"MemoryBytes":1024,"Duration":2500,"WeekKey":"2026-W41","MonthKey":"2026-10","DayKey":"2026-10-07","DailyBucketKey":"bucket"}""";
    static readonly JsonSerializerOptions _serializerOptions = new() { Converters = { new ConceptAsJsonConverterFactory() } };
    AgentSessionUsageRecorded _legacy;
    object[] _mixed;
    AgentUsageByDay _day;
    AgentUsageByWeek _week;
    AgentUsageByMonth _month;
    AgentUsageByDay _oldDay;

    async Task Because()
    {
        _legacy = JsonSerializer.Deserialize<AgentSessionUsageRecorded>(LegacyJson, _serializerOptions)!;
        var prepared = _command.Provide(_clock, _snapshots);
        var usage = prepared.Usage with { WeekKey = _legacy.WeekKey, MonthKey = _legacy.MonthKey, DayKey = _legacy.DayKey, DailyBucketKey = _legacy.DailyBucketKey };
        _mixed = [_legacy, .. _command.Handle(prepared with { Usage = usage })];
        _oldDay = await Replay<AgentUsageByDay>(_legacy);
        _day = await Replay<AgentUsageByDay>(_mixed);
        _week = await Replay<AgentUsageByWeek>(_mixed);
        _month = await Replay<AgentUsageByMonth>(_mixed);
    }

    static async Task<T> Replay<T>(params object[] events)
        where T : class
    {
        var scenario = new ReadModelScenario<T>();
        await scenario.Given.ForEventSource(_session).Events(events);
        return scenario.Instance!;
    }

    [Fact] void should_replay_the_historical_event_without_new_fields() => _oldDay.InputTokens.ShouldEqual(120L);
    [Fact] void should_not_invent_allowance_on_the_old_event() => _legacy.GetType().GetProperty("Snapshot").ShouldBeNull();
    [Fact] void should_keep_the_legacy_event_identity() => AgentSessionUsageRecorded.EventTypeId.ShouldEqual("f16f9c1a-6b0a-4c8e-9c7c-2f0f9b7c5a01");
    [Fact] void should_not_count_the_companion_as_a_session() => _day.Sessions.ShouldEqual(2);
    [Fact] void should_not_double_count_tokens() => _day.InputTokens.ShouldEqual(240L);
    [Fact] void should_preserve_daily_cost() => _day.Cost.ShouldEqual(0.04m);
    [Fact] void should_preserve_daily_cpu() => _day.CpuSeconds.ShouldEqual(7.0m);
    [Fact] void should_preserve_weekly_cpu() => _week.CpuSeconds.Value.ShouldEqual(7.0m);
    [Fact] void should_preserve_monthly_memory() => _month.MemoryBytes.Value.ShouldEqual(2048L);
    [Fact] void should_keep_the_companion_a_separate_fact() => _mixed.OfType<AgentSessionCapacityObserved>().Single().Snapshot.State.ShouldEqual(AIProviderCapacitySnapshotState.Available);
}
