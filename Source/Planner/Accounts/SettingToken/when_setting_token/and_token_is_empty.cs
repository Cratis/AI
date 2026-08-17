// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Identity;

namespace Planner.Accounts.SettingToken.when_setting_token;

public class and_token_is_empty : Specification
{
    static readonly AccountId _accountId = AccountId.New();

    CommandScenario<SetAccountToken> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because()
    {
        // The command requires an authenticated operator; a spec has no HTTP request, so it runs
        // as a trusted system actor - the same scope the production automation uses.
        using var scope = SystemExecutionScope.Enter();
        _result = await _scenario.Execute(new SetAccountToken(_accountId, string.Empty));
    }

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_have_validation_errors() => _result.ShouldHaveValidationErrors();
}
#endif
