// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;

namespace Cratis.AI.Usage.Daily.for_AgentUsageBucketKey.when_resolving;

/// <summary>
/// Every dimension the usage page can narrow by has to separate buckets on its own, or a filter on
/// it would silently read a total that includes what it filtered out.
/// </summary>
public class and_only_one_dimension_differs : Specification
{
    static readonly DayKey _day = new("2026-01-08");
    static readonly AIProviderId _provider = AIProviderId.New();
    static readonly AgentId _agent = new("wright");
    static readonly LanguageModelPurpose _purpose = new("Investigation");
    static readonly ModelName _model = new("sonnet");

    AgentUsageBucketKey _baseline;

    void Establish() => _baseline = AgentUsageBucketKey.For(_day, _provider, _agent, _purpose, _model);

    [Fact]
    void should_separate_a_different_day() =>
        AgentUsageBucketKey.For(new DayKey("2026-01-09"), _provider, _agent, _purpose, _model).ShouldNotEqual(_baseline);

    [Fact]
    void should_separate_a_different_provider() =>
        AgentUsageBucketKey.For(_day, AIProviderId.New(), _agent, _purpose, _model).ShouldNotEqual(_baseline);

    [Fact]
    void should_separate_an_unresolved_provider_from_a_resolved_one() =>
        AgentUsageBucketKey.For(_day, null, _agent, _purpose, _model).ShouldNotEqual(_baseline);

    [Fact]
    void should_separate_a_different_agent() =>
        AgentUsageBucketKey.For(_day, _provider, new AgentId("other"), _purpose, _model).ShouldNotEqual(_baseline);

    [Fact]
    void should_separate_a_different_model() =>
        AgentUsageBucketKey.For(_day, _provider, _agent, _purpose, new ModelName("haiku")).ShouldNotEqual(_baseline);
}
