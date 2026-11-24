// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Capacity;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI.Usage.Recording.for_RecordAgentSessionUsageWithCapacity.when_discovering;

public class the_new_command : given.a_usage_boundary
{
    readonly ManagementCommandScenario<RecordAgentSessionUsageWithCapacity> _scenario = new();
    CommandResult _result;
    void Establish()
    {
        _scenario.Services.AddSingleton(_clock);
        _scenario.Services.AddSingleton<IAIProviderCapacitySnapshots>(_snapshots);
    }
    async Task Because() => _result = await _scenario.Execute(_command);
    [Fact] void should_prepare_and_execute_through_the_command_pipeline() => _result.IsSuccess.ShouldBeTrue();
    [Fact] void should_discover_and_call_the_capture_dependency_once() => _snapshots.Received(1).Capture(_provider);
    [Fact] async Task should_append_usage_on_the_session_stream() => await _scenario.EventSequence.ShouldHaveAppendedEvent<AgentSessionUsageRecorded>((EventSourceId)_session);
    [Fact] async Task should_append_the_companion_on_the_same_stream() => await _scenario.EventSequence.ShouldHaveAppendedEvent<AgentSessionCapacityObserved>((EventSourceId)_session);
}
