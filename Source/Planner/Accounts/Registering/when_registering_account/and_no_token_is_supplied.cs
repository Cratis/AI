// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Accounts.SettingToken;

namespace Planner.Accounts.Registering.when_registering_account;

public class and_no_token_is_supplied : Specification
{
    CommandScenario<RegisterAccount> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new RegisterAccount("Secondary", ClaudePlan.Pro));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_account_registered() => _scenario.EventSequence.ShouldHaveAppendedEvent<ClaudeAccountRegistered>(
        @event => @event.Name == new AccountName("Secondary"));

    [Fact]
    public async Task should_not_append_token_set()
    {
        var error = await Cratis.Specifications.Catch.Exception(async () =>
            await Task.Run(() => _scenario.EventSequence.ShouldHaveAppendedEvent<ClaudeAccountTokenSet>()));
        error.ShouldNotBeNull();
    }
}
#endif
