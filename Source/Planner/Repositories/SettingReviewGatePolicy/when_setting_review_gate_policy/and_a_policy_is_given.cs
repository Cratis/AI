// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Repositories.SettingReviewGatePolicy.when_setting_review_gate_policy;

public class and_a_policy_is_given : Specification
{
    CommandScenario<SetReviewGatePolicy> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new SetReviewGatePolicy(
        RepositoryId.From("Cratis", "Studio"), ReviewGatePolicy.Auto));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_review_gate_policy_set() => _scenario.EventSequence.ShouldHaveAppendedEvent<ReviewGatePolicySet>(
        @event => @event.Policy == ReviewGatePolicy.Auto);
}
#endif
