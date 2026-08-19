// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.GitHub.GitIdentity.Setting.when_setting_git_identity;

public class and_information_is_valid : Specification
{
    CommandScenario<SetGitIdentity> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new SetGitIdentity("Stagehand (AI)", "stagehand-ai@users.noreply.github.com"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_git_identity_set() => _scenario.EventSequence.ShouldHaveAppendedEvent<GitIdentitySet>(
        @event =>
            @event.Name == new GitUserName("Stagehand (AI)") &&
            @event.Email == new GitUserEmail("stagehand-ai@users.noreply.github.com"));
}
#endif
