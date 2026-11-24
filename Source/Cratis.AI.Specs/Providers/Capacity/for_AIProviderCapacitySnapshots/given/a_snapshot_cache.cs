// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.UsageReporting;
using Cratis.Chronicle.ReadModels;
using Cratis.Types;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacitySnapshots.given;

public class a_snapshot_cache : Specification
{
    protected static readonly AIProviderId _provider = AIProviderId.New();
    protected static readonly DateTimeOffset _start = new(2026, 10, 7, 12, 0, 0, TimeSpan.Zero);
    protected MutableClock _clock;
    protected AIProviderCapacityObservations _observations;
    protected AIProviderCapacitySnapshots _snapshots;
    protected IReadModels _readModels;
    protected ICanReportAIProviderCapacity _reporter;
    protected IProviderUsageLevels _levels;
    protected AIProviderCapacities _capacities;
    protected int _reads;

    void Establish()
    {
        _clock = new() { Now = _start };
        var options = Options.Create(new AIProviderOptions { CapacityFreshness = TimeSpan.FromMinutes(5) });
        _observations = new(_clock, options);
        _snapshots = new(_observations, _clock, options);
        _readModels = Substitute.For<IReadModels>();
        _reporter = Substitute.For<ICanReportAIProviderCapacity>();
        _levels = Substitute.For<IProviderUsageLevels>();
        _levels.RefreshMany(Arg.Any<IReadOnlyCollection<AIProviderId>>(), Arg.Any<CancellationToken>()).Returns(new Dictionary<AIProviderId, ProviderUsageLevel>());
        _capacities = new(_readModels, new KnownInstancesOf<ICanReportAIProviderCapacity>(_reporter), _observations, _levels, _clock, options, Microsoft.Extensions.Logging.Abstractions.NullLogger<AIProviderCapacities>.Instance);
    }

    protected Task<AIProviderCapacityObservation> Observe(AIProviderCapacityReport report, string? credential = null) =>
        _observations.Observe(
            _provider,
            _ =>
            {
                _reads++;
                return Task.FromResult(report);
            },
            credential);

    protected void Configure(ConfiguredAIProvider provider) =>
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_provider).Returns(provider);

    protected sealed class MutableClock : TimeProvider
    {
        public DateTimeOffset Now { get; set; }
        public override DateTimeOffset GetUtcNow() => Now;
    }
}
