// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Identity;

namespace Planner.Accounts.SettingToken.when_setting_token;

/// <summary>
/// Proves the command genuinely refuses an anonymous caller rather than merely carrying an attribute
/// nobody evaluates - the other specs in this folder only pass because they say who they run as.
/// </summary>
public class and_there_is_no_authenticated_operator : Specification
{
    static readonly AccountId _accountId = AccountId.New();

    CommandScenario<SetAccountToken> _scenario;
    CommandResult _result;

    void Establish()
    {
        _scenario = new();

        // CommandScenarioDefaultCaller establishes an authenticated caller for every scenario by
        // default, so a command spec that never mentions authorization keeps testing the behavior it
        // was written for. This spec's whole purpose is the opposite - proving the command refuses a
        // caller with no principal at all - so it overrides that default back off.
        _scenario.Services.AddSingleton(CommandScenarioDefaultCaller.NoRequestContext());
    }

    async Task Because() => _result = await _scenario.Execute(new SetAccountToken(_accountId, "sk-ant-rotated"));

    [Fact] void should_not_succeed() => _result.IsSuccess.ShouldBeFalse();
    [Fact] void should_refuse_the_caller() => _result.IsAuthorized.ShouldBeFalse();

    // Refused before validation, so the rejection is authorization and not a complaint about the token.
    [Fact] void should_not_have_gotten_as_far_as_validating() => _result.ValidationResults.ShouldBeEmpty();
}
#endif
