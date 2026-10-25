// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics.Metrics;

namespace Cratis.AI.Providers.UsageReporting.for_RecentUsageSnapshots;

public class when_collecting_metrics : Specification
{
    readonly AIProviderId _provider = AIProviderId.New();
    readonly List<long> _values = [];
    MeterListener _listener;
    RecentUsageSnapshots _cache;
    string? _availability;

    void Establish()
    {
        _listener = new()
        {
            InstrumentPublished = (instrument, listener) =>
            {
                if (instrument.Meter.Name == RecentUsageSnapshots.MeterName && instrument.Name == "cratis.ai.provider.consumed_tokens")
                {
                    listener.EnableMeasurementEvents(instrument);
                }
            }
        };
        _listener.SetMeasurementEventCallback<long>((_, value, tags, _) =>
        {
            var labels = tags.ToArray().ToDictionary(tag => tag.Key, tag => tag.Value);
            if ((labels.GetValueOrDefault("provider") as string) == _provider.Value.ToString())
            {
                _values.Add(value);
                _availability = labels["availability"] as string;
            }
        });
        _listener.Start();
        _cache = new(TimeProvider.System);
        _cache.Record(_provider, new(AIUsageReportAvailability.Available, 900, false, null));
        _cache.Record(_provider, new(AIUsageReportAvailability.Unreachable, 123, true, null));
    }

    void Because() => _listener.RecordObservableInstruments();

    [Fact] void should_report_only_the_latest_reading() => _values.ShouldContainOnly(123L);
    [Fact] void should_tag_the_availability() => _availability.ShouldEqual("Unreachable");

    void Destroy()
    {
        _listener.Dispose();
        _cache.Dispose();
    }
}
