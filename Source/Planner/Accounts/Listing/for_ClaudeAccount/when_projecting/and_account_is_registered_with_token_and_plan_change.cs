// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Accounts.ChangingPlan;
using Planner.Accounts.Registering;
using Planner.Accounts.SettingToken;

namespace Planner.Accounts.Listing.for_ClaudeAccount.when_projecting;

public class and_account_is_registered_with_token_and_plan_change : Specification
{
    static readonly AccountId _accountId = AccountId.New();

    ReadModelScenario<ClaudeAccount> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_accountId)
            .Events(
                new ClaudeAccountRegistered("Primary", ClaudePlan.Pro),
                new ClaudeAccountTokenSet("sk-ant-token"),
                new ClaudeAccountPlanChanged(ClaudePlan.Max20x));

    [Fact] void should_hold_the_name() => _scenario.Instance.Name.ShouldEqual(new AccountName("Primary"));
    [Fact] void should_hold_the_changed_plan() => _scenario.Instance.Plan.ShouldEqual(ClaudePlan.Max20x);
    [Fact] void should_have_a_token() => _scenario.Instance.HasToken.ShouldBeTrue();
}
#endif
