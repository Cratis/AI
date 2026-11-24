// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Agents.Defining.when_validating_assignments;

public class and_a_pool_member_is_unknown_despite_a_supporting_member : given.assignment_validators
{
    void Establish()
    {
        KnownProvider();
        KnownPool([new(_providerId), new(AIProviderId.New())]);
    }

    Task Because() => Validate(pool: _poolId);

    [Fact] void should_reject_the_assignment() => _results.ShouldEachConformTo(result => !result.IsValid);
    [Fact] void should_identify_the_unknown_member() => _results.ShouldEachConformTo(result =>
        result.Errors.Exists(error => error.ErrorMessage == "The selected pool contains an unknown provider"));
}
