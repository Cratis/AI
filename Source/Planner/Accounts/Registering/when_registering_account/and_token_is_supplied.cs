// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Accounts.SettingToken;

namespace Planner.Accounts.Registering.when_registering_account;

public class and_token_is_supplied : Specification
{
    CommandScenario<RegisterAccount> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new RegisterAccount("Primary", ClaudePlan.Max20x, "sk-ant-token"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_account_registered() => _scenario.EventSequence.ShouldHaveAppendedEvent<ClaudeAccountRegistered>(
        @event =>
            @event.Name == new AccountName("Primary") &&
            @event.Plan == ClaudePlan.Max20x);

    [Fact]
    void should_append_token_set() => _scenario.EventSequence.ShouldHaveAppendedEvent<ClaudeAccountTokenSet>(
        @event => @event.Token == new ClaudeToken("sk-ant-token"));
}
#endif
