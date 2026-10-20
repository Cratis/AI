// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Threading.Channels;
using Cratis.AI.Providers;
using Cratis.Chronicle.ReadModels;

namespace Cratis.AI.Providers.UsageReporting.Snapshots.for_AIProviderUsageSnapshot.given;

public class cached_readings : Specification
{
    protected readonly AIProviderId _visible = AIProviderId.New();
    protected readonly AIProviderId _hidden = AIProviderId.New();
    protected readonly DateTimeOffset _recordedAt = new(2026, 8, 1, 12, 0, 0, TimeSpan.Zero);
    protected readonly Channel<IEnumerable<AIProviderUsageSnapshot>> _emissions = Channel.CreateUnbounded<IEnumerable<AIProviderUsageSnapshot>>();
    protected RecentUsageSnapshots _cache;
    protected IReadModels _readModels;
    protected TimeProvider _clock;
    protected IDisposable _subscription;

    void Establish()
    {
        _clock = Substitute.For<TimeProvider>();
        _clock.GetUtcNow().Returns(_recordedAt);
        _cache = new(_clock);
        _cache.Record(_visible, new(AIUsageReportAvailability.Available, 42, false, null));
        _cache.Record(_hidden, new(AIUsageReportAvailability.Available, 999, false, null));
        _readModels = Substitute.For<IReadModels>();
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_visible).Returns(new ConfiguredAIProvider(_visible, AIProviderType.Anthropic, AIProviderApiKey.NotSet));
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_hidden).Returns((ConfiguredAIProvider)null!);
    }

    protected void Subscribe() => _subscription = AIProviderUsageSnapshot.AllAIProviderUsageSnapshots(_cache, _readModels)
        .Subscribe(readings => _emissions.Writer.TryWrite(readings), error => _emissions.Writer.TryComplete(error));

    protected async Task<AIProviderUsageSnapshot[]> Next() => (await _emissions.Reader.ReadAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(5), TimeProvider.System)).ToArray();

    void Destroy()
    {
        _subscription?.Dispose();
        _cache.Dispose();
    }
}
