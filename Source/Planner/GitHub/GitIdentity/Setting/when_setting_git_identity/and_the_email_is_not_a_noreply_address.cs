// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.GitHub.GitIdentity.Setting.when_setting_git_identity;

public class and_the_email_is_not_a_noreply_address : Specification
{
    CommandScenario<SetGitIdentity> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new SetGitIdentity("Stagehand (AI)", "planner@cratis.io"));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_have_validation_errors() => _result.ShouldHaveValidationErrors();
}
#endif
