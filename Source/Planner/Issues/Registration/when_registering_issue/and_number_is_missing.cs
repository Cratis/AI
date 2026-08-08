// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Issues.Registration.when_registering_issue;

public class and_number_is_missing : Specification
{
    CommandScenario<RegisterIssue> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(
        new RegisterIssue("Cratis", "Studio", 0, "Fix the thing", "Bug", "someuser", DateTimeOffset.UnixEpoch, AuthorAssociation.Member, true));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_have_validation_errors() => _result.ShouldHaveValidationErrors();
}
#endif
