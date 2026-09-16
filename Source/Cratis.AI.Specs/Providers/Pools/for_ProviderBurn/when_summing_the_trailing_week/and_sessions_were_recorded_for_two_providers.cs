// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Cratis.AI.Usage.Daily;
using NSubstitute;

namespace Cratis.AI.Providers.Pools.for_ProviderBurn.when_summing_the_trailing_week;

public class and_sessions_were_recorded_for_two_providers : Specification
{
    static readonly AIProviderId _first = AIProviderId.New();
    static readonly AIProviderId _second = AIProviderId.New();
    static readonly DateTimeOffset _now = new(2026, 1, 8, 0, 0, 0, TimeSpan.Zero);

    IRecordedAgentSessions _sessions;
    ProviderBurn _burn;
    ProviderBurnOverTrailingWeek _result;

    void Establish()
    {
        _sessions = Substitute.For<IRecordedAgentSessions>();
        _sessions.RecordedSince(Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>()).Returns(
        [
            new RecordedAgentSession(_now.AddDays(-1), _first, new AgentId("triage"), new LanguageModelPurpose("triage"), new ModelName("sonnet"), 100, 50, 0m, 0),
            new RecordedAgentSession(_now.AddDays(-2), _first, new AgentId("triage"), new LanguageModelPurpose("triage"), new ModelName("sonnet"), 200, 100, 0m, 0),
            new RecordedAgentSession(_now.AddDays(-1), _second, new AgentId("triage"), new LanguageModelPurpose("triage"), new ModelName("mini"), 10, 5, 0m, 0),
        ]);

        var timeProvider = Substitute.For<TimeProvider>();
        timeProvider.GetUtcNow().Returns(_now);
        _burn = new ProviderBurn(_sessions, timeProvider);
    }

    async Task Because() => _result = await _burn.TrailingWeek();

    [Fact] void should_sum_the_first_providers_tokens() => _result.Tokens[_first].ShouldEqual(450L);
    [Fact] void should_sum_the_second_providers_tokens() => _result.Tokens[_second].ShouldEqual(15L);
    [Fact] void should_count_the_first_providers_sessions() => _result.Sessions[_first].ShouldEqual(2);
    [Fact] void should_count_the_second_providers_sessions() => _result.Sessions[_second].ShouldEqual(1);
}
