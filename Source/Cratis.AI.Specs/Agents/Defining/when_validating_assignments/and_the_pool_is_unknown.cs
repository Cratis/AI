// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Agents.Defining.when_validating_assignments;

public class and_the_pool_is_unknown : given.assignment_validators
{
    Task Because() => Validate(pool: _poolId);

    [Fact] void should_reject_the_assignment() => _results.ShouldEachConformTo(result => !result.IsValid);
    [Fact] void should_identify_the_unknown_pool() => _results.ShouldEachConformTo(result =>
        result.Errors.Exists(error => error.ErrorMessage == "The selected pool is unknown"));
}
