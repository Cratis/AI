// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;

namespace Cratis.AI.Usage.Daily.for_AgentUsageBucketKey.when_resolving;

/// <summary>
/// What answers "how much CPU/memory went to investigation versus planning versus implementation for
/// an agent" (Cratis/AI#337's follow-up request). That separation used to be an in-memory
/// <c>GroupBy</c> inside <c>AgentUsageByDay.LastYear</c>; now that the daily model is a real
/// accumulating projection, purpose is a dimension of the key each row accumulates under, so this
/// is where the separation has to be proven.
/// </summary>
public class and_two_purposes_ran_the_same_day : Specification
{
    static readonly DayKey _day = new("2026-01-08");
    static readonly AgentId _agent = new("wright");
    static readonly ModelName _model = new("sonnet");

    AgentUsageBucketKey _investigation;
    AgentUsageBucketKey _sameInvestigationAgain;
    AgentUsageBucketKey _implementation;

    void Because()
    {
        _investigation = AgentUsageBucketKey.For(_day, null, _agent, new LanguageModelPurpose("Investigation"), _model);
        _sameInvestigationAgain = AgentUsageBucketKey.For(_day, null, _agent, new LanguageModelPurpose("Investigation"), _model);
        _implementation = AgentUsageBucketKey.For(_day, null, _agent, new LanguageModelPurpose("Implementation"), _model);
    }

    [Fact]
    void should_accumulate_two_sessions_of_one_purpose_into_the_same_bucket() =>
        _sameInvestigationAgain.ShouldEqual(_investigation);

    [Fact]
    void should_keep_a_different_purpose_in_its_own_bucket() =>
        _implementation.ShouldNotEqual(_investigation);
}
