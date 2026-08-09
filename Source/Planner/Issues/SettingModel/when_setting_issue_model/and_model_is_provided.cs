// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Issues.SettingModel.when_setting_issue_model;

public class and_model_is_provided : Specification
{
    CommandScenario<SetIssueModel> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new SetIssueModel("cratis-studio-256", "opus"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_issue_model_overridden() => _scenario.EventSequence.ShouldHaveAppendedEvent<IssueModelOverridden>(
        @event => @event.Model == new ModelName("opus"));
}
#endif
