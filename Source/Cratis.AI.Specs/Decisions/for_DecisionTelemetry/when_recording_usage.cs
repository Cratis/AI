// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics.Metrics;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Decisions.for_DecisionTelemetry;

public class when_recording_usage : Specification
{
    readonly string _topic = Guid.NewGuid().ToString();
    readonly Dictionary<string, long> _measurements = new();
    MeterListener _listener;
    DecisionTelemetry _telemetry;

    void Establish()
    {
        _listener = new()
        {
            InstrumentPublished = (instrument, listener) =>
            {
                if (instrument.Meter.Name == DecisionTelemetry.Name)
                {
                    listener.EnableMeasurementEvents(instrument);
                }
            }
        };
        _listener.SetMeasurementEventCallback<long>((instrument, value, tags, _) =>
        {
            var labels = tags.ToArray().ToDictionary(tag => tag.Key, tag => tag.Value);
            if ((labels.GetValueOrDefault("topic") as string) == _topic)
            {
                labels["decision.engine"].ShouldEqual("BuiltIn");
                labels["model"].ShouldEqual("model");
                _measurements[instrument.Name] = value;
            }
        });
        _listener.Start();
        _telemetry = new(Options.Create(new DecisionOptions()));
    }

    void Because() => _telemetry.RecordUsage(DecisionEngineType.BuiltIn, "model", _topic, 2, 6, 42, 7);

    [Fact] void should_record_input_tokens() => _measurements["cratis.ai.decision.input_tokens"].ShouldEqual(42L);
    [Fact] void should_record_output_tokens() => _measurements["cratis.ai.decision.output_tokens"].ShouldEqual(7L);
    [Fact] void should_count_one_call() => _measurements["cratis.ai.decision.calls"].ShouldEqual(1L);
    [Fact] void should_count_decisions() => _measurements["cratis.ai.decision.decisions"].ShouldEqual(2L);
    [Fact] void should_count_choices() => _measurements["cratis.ai.decision.choices"].ShouldEqual(6L);

    void Destroy()
    {
        _listener.Dispose();
        _telemetry.Dispose();
    }
}
