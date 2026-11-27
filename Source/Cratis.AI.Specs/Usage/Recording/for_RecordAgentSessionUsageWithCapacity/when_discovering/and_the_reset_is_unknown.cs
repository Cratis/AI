// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.AI.Providers.Capacity;
using Cratis.Json;
using Cratis.Serialization;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI.Usage.Recording.for_RecordAgentSessionUsageWithCapacity.when_discovering;

public class and_the_reset_is_unknown : given.a_usage_boundary
{
    readonly ManagementCommandScenario<RecordAgentSessionUsageWithCapacity> _scenario = new();
    CommandResult _result;
    AgentSessionUsageRecorded _usage;
    AgentSessionCapacityObserved _companion;

    void Establish()
    {
        _snapshot = _snapshot with { Windows = [new(UsageWindowKind.Weekly, "weekly", 0.4, AIProviderCapacitySnapshot.UnknownTime)] };
        _snapshots.Capture(_provider).Returns(_snapshot);
        _scenario.Services.AddSingleton(_clock);
        _scenario.Services.AddSingleton<IAIProviderCapacitySnapshots>(_snapshots);
    }

    async Task Because()
    {
        _result = await _scenario.Execute(_command);
        await _scenario.EventSequence.ShouldHaveAppendedEvent<AgentSessionUsageRecorded>((EventSourceId)_session, @event => _usage = RoundTrip(@event));
        await _scenario.EventSequence.ShouldHaveAppendedEvent<AgentSessionCapacityObserved>((EventSourceId)_session, @event => _companion = RoundTrip(@event));
    }

    static T RoundTrip<T>(T @event)
    {
        var options = new JsonSerializerOptions { PropertyNamingPolicy = new DefaultNamingPolicy().JsonPropertyNamingPolicy, Converters = { new ConceptAsJsonConverterFactory() } };
        return JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(@event, options), options)!;
    }

    [Fact] void should_execute_the_command_successfully() => _result.IsSuccess.ShouldBeTrue();
    [Fact] void should_round_trip_the_usage_on_the_session_stream() => _usage.Session.ShouldEqual(_session);
    [Fact] void should_preserve_the_usage_measurements() => _usage.InputTokens.ShouldEqual(_command.InputTokens);
    [Fact] void should_round_trip_the_companion_on_the_session_stream() => _companion.Session.ShouldEqual(_session);
    [Fact] void should_preserve_the_actual_provider() => _companion.Snapshot.Provider.ShouldEqual(_provider);
    [Fact] void should_preserve_the_unknown_reset_sentinel() => _companion.Snapshot.Windows.Single().ResetsAt.ShouldEqual(AIProviderCapacitySnapshot.UnknownTime);
    [Fact] void should_preserve_the_allowance_window() => _companion.Snapshot.Windows.ShouldEqual(_snapshot.Windows);
}
