// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.Extensions.DependencyInjection;
using Planner.Accounts.SettingToken;
using Planner.Identity;

namespace Planner.Accounts.Registering.when_registering_account;

public class and_no_token_is_supplied : Specification
{
    CommandScenario<RegisterAccount> _scenario;
    CommandResult _result;

    void Establish()
    {
        _scenario = new();
        var currentUser = Substitute.For<Planner.Identity.ICurrentUser>();
        currentUser.GetUserName().Returns(UserName.NotSet);
        _scenario.Services.AddSingleton(currentUser);
    }

    async Task Because()
    {
        // The command requires an authenticated operator; a spec has no HTTP request, so it runs
        // as a trusted system actor - the same scope the production automation uses.
        using var scope = SystemExecutionScope.Enter();
        _result = await _scenario.Execute(new RegisterAccount("Secondary", ClaudePlan.Pro));
    }

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
