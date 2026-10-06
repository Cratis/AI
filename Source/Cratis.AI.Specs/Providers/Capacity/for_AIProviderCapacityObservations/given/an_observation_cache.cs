// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacityObservations.given;

public class an_observation_cache : Specification
{
    protected static readonly AIProviderId _provider = AIProviderId.New();
    protected static readonly DateTimeOffset _start = new(2026, 10, 7, 12, 0, 0, TimeSpan.Zero);
    protected static readonly IReadOnlyList<UsageWindow> _goodWindows = [new(UsageWindowKind.FiveHour, "5-hour", 0.3, null)];

    protected MutableTimeProvider _timeProvider;
    protected AIProviderCapacityObservations _observations;
    protected int _reads;
    protected Func<AIProviderCapacityReport> _vendor;

    void Establish()
    {
        _timeProvider = new(_start);
        _observations = new(_timeProvider, Options.Create(new AIProviderOptions { CapacityFreshness = TimeSpan.FromMinutes(5) }));
        _vendor = () => AIProviderCapacityReport.Subscription(_goodWindows);
    }

    protected Task<AIProviderCapacityObservation> Observe() =>
        _observations.Observe(_provider, _ =>
        {
            _reads++;
            return Task.FromResult(_vendor());
        });

    protected sealed class MutableTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = now;

        public override DateTimeOffset GetUtcNow() => Now;
    }
}
