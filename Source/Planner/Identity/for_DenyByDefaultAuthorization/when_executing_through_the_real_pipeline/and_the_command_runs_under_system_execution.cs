// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Accounts;
using Planner.Accounts.Removing;

namespace Planner.Identity.for_DenyByDefaultAuthorization.when_executing_through_the_real_pipeline;

public class and_the_command_runs_under_system_execution : Specification
{
    static readonly AccountId _accountId = AccountId.New();

    CommandScenario<RemoveAccount> _scenario;
    CommandResult _result;

    void Establish()
    {
        _scenario = new();

        // SystemExecutionScope establishes its principal through an AsyncLocal override, which
        // CurrentPrincipalAccessor only consults when there is no HTTP request in progress - so
        // CommandScenarioDefaultCaller's own (non-null) request context must be cleared first, or the
        // scope entered below would have no effect and this would stop proving what it claims to.
        _scenario.Services.AddSingleton(CommandScenarioDefaultCaller.NoRequestContext());
    }

    async Task Because()
    {
        // The same scope production reactors use (e.g. AlertInvestigation.On) to run a command that
        // requires an authenticated operator with no HTTP request behind it. Entered and consumed
        // within this one method - SystemExecutionScope relies on an AsyncLocal override, and
        // Cratis.Specifications does not guarantee Establish and Because share a flow.
        using var scope = SystemExecutionScope.Enter();
        _result = await _scenario.Execute(new RemoveAccount(_accountId));
    }

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] void should_append_account_removed() => _scenario.EventSequence.ShouldHaveAppendedEvent<ClaudeAccountRemoved>();
}
#endif
