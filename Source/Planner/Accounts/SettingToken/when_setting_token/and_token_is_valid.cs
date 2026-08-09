// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Accounts.SettingToken.when_setting_token;

public class and_token_is_valid : Specification
{
    static readonly AccountId _accountId = AccountId.New();

    CommandScenario<SetAccountToken> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new SetAccountToken(_accountId, "sk-ant-rotated"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_token_set() => _scenario.EventSequence.ShouldHaveAppendedEvent<ClaudeAccountTokenSet>(
        @event => @event.Token == new ClaudeToken("sk-ant-rotated"));
}
#endif
