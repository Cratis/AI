// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Usage.Daily;

namespace Cratis.AI.Usage.for_RecordAgentSessionUsage.when_handling;

/// <summary>
/// The command appends on the session's own stream, and every optional figure that was reported
/// carries through onto the event unchanged.
/// </summary>
public class and_every_figure_is_reported : Specification
{
    static readonly AgentSessionId _session = AgentSessionId.New();
    static readonly AgentId _agent = new("triage");

    RecordAgentSessionUsage _command;
    (AgentSessionId Id, AgentSessionUsageRecorded Event) _result;

    void Establish() => _command = new RecordAgentSessionUsage(
        _session,
        _agent,
        new ModelName("sonnet"),
        new LanguageModelPurpose("triage"),
        Provider: AIProviderId.New(),
        InputTokens: new InputTokens(120),
        OutputTokens: new OutputTokens(45),
        CachedTokens: new CachedTokens(10),
        CostUsd: new CostUsd(0.02m),
        CpuSeconds: new CpuSeconds(3.5m),
        MemoryBytes: new MemoryBytes(1024),
        Duration: new DurationMilliseconds(2500));

    void Because() => _result = _command.Handle(new UsagePeriod(new WeekKey("2026-W01"), new MonthKey("2026-01"), new DayKey("2026-01-02"), new AgentUsageBucketKey("bucket")));

    [Fact] void should_append_on_the_sessions_own_stream() => _result.Id.ShouldEqual(_session);
    [Fact] void should_carry_the_session() => _result.Event.Session.ShouldEqual(_session);
    [Fact] void should_carry_the_agent() => _result.Event.Agent.ShouldEqual(_agent);
    [Fact] void should_carry_input_tokens() => _result.Event.InputTokens.Value.ShouldEqual(120L);
    [Fact] void should_carry_output_tokens() => _result.Event.OutputTokens.Value.ShouldEqual(45L);
    [Fact] void should_carry_cached_tokens() => _result.Event.CachedTokens.Value.ShouldEqual(10L);
    [Fact] void should_carry_cost() => _result.Event.CostUsd.Value.ShouldEqual(0.02m);
    [Fact] void should_carry_cpu_seconds() => _result.Event.CpuSeconds.Value.ShouldEqual(3.5m);
    [Fact] void should_carry_memory_bytes() => _result.Event.MemoryBytes.Value.ShouldEqual(1024L);
    [Fact] void should_carry_duration() => _result.Event.Duration.Value.ShouldEqual(2500L);
    [Fact] void should_carry_the_week_key() => _result.Event.WeekKey.Value.ShouldEqual("2026-W01");
    [Fact] void should_carry_the_month_key() => _result.Event.MonthKey.Value.ShouldEqual("2026-01");
    [Fact] void should_carry_the_day_key() => _result.Event.DayKey.Value.ShouldEqual("2026-01-02");
    [Fact] void should_carry_the_daily_bucket_key() => _result.Event.DailyBucketKey.Value.ShouldEqual("bucket");
}
