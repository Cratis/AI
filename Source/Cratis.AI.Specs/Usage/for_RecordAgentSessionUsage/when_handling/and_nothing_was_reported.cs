// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Cratis.AI.Usage.Daily;

namespace Cratis.AI.Usage.for_RecordAgentSessionUsage.when_handling;

/// <summary>
/// A direct completion with no harness reports no CPU/memory - the optional figures default to
/// their concept's own "not set" value rather than null propagating onto the event, so every
/// consumer of <see cref="AgentSessionUsageRecorded"/> can read every property without a null check.
/// </summary>
public class and_nothing_was_reported : Specification
{
    RecordAgentSessionUsage _command;
    (AgentSessionId Id, AgentSessionUsageRecorded Event) _result;

    void Establish() => _command = new RecordAgentSessionUsage(
        AgentSessionId.New(),
        new AgentId("triage"),
        new ModelName("sonnet"),
        new LanguageModelPurpose("triage"));

    void Because() => _result = _command.Handle(new UsagePeriod(WeekKey.NotSet, MonthKey.NotSet, DayKey.NotSet, AgentUsageBucketKey.NotSet));

    [Fact] void should_default_cpu_seconds_to_not_set() => _result.Event.CpuSeconds.ShouldEqual(CpuSeconds.NotSet);
    [Fact] void should_default_memory_bytes_to_not_set() => _result.Event.MemoryBytes.ShouldEqual(MemoryBytes.NotSet);
    [Fact] void should_default_cost_to_not_set() => _result.Event.CostUsd.ShouldEqual(CostUsd.NotSet);
    [Fact] void should_default_the_harness_to_null() => _result.Event.Harness.ShouldBeNull();
    [Fact] void should_default_the_provider_to_null() => _result.Event.Provider.ShouldBeNull();
}
