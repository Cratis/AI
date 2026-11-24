// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Agents.Defining.when_validating_assignments;

public class and_no_assignment_is_given : given.assignment_validators
{
    Task Because() => Validate();

    [Fact] void should_accept_the_assignment() => _results.ShouldEachConformTo(result => result.IsValid);
}
