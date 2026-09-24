// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;
using Cratis.AI.Usage.Daily;

namespace Cratis.AI.Providers.UsageReporting.for_AIProviderUsage.given;

public class all_dependencies : Specification
{
    protected static readonly DateTimeOffset _now = new(2026, 8, 27, 12, 0, 0, TimeSpan.Zero);
    protected static readonly AIProviderId _providerOne = AIProviderId.New();
    protected static readonly AIProviderId _providerTwo = AIProviderId.New();

    protected IRecordedAgentSessions _sessions;
    protected TimeProvider _timeProvider;
    protected IEnumerable<AIProviderUsage> _result;

    protected List<RecordedAgentSession> _recorded;

    void Establish()
    {
        _recorded = [];
        _sessions = Substitute.For<IRecordedAgentSessions>();
        _sessions.RecordedSince(Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>()).Returns(_ => _recorded);

        _timeProvider = Substitute.For<TimeProvider>();
        _timeProvider.GetUtcNow().Returns(_now);
    }

    /// <summary>
    /// Records one session against a provider, <paramref name="daysAgo"/> before the fixed now.
    /// </summary>
    /// <param name="provider">The provider the session ran on.</param>
    /// <param name="tokens">The tokens it spent, split across input and output.</param>
    /// <param name="daysAgo">How long before now it was recorded - past seven puts it outside the trailing week.</param>
    protected void RecordSession(AIProviderId provider, long tokens, double daysAgo = 0) =>
        _recorded.Add(new(
            _now.AddDays(-daysAgo),
            provider,
            null,
            new LanguageModelPurpose("IssueTriage"),
            new ModelName("some-model"),
            tokens,
            0,
            0m,
            0));
}
