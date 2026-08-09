// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.GitHub.App.Installations.Installing.when_recording_installation;

public class and_installation_is_specified : Specification
{
    CommandScenario<RecordGitHubAppInstallation> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new RecordGitHubAppInstallation(123456L, "Cratis"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_git_hub_app_installed() => _scenario.EventSequence.ShouldHaveAppendedEvent<GitHubAppInstalled>(
        @event => @event.Account == new OrganizationName("Cratis"));
}
#endif
