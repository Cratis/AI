// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Roadmap.SettingVision.when_setting_vision;

public class and_content_is_given : Specification
{
    CommandScenario<SetVision> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new SetVision("Cratis is going towards autonomous operation."));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_vision_set() => _scenario.EventSequence.ShouldHaveAppendedEvent<VisionSet>(
        @event => @event.Content == new VisionContent("Cratis is going towards autonomous operation."));
}
#endif
