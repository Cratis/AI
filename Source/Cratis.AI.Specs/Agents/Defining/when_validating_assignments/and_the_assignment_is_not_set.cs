// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;

namespace Cratis.AI.Agents.Defining.when_validating_assignments;

public class and_the_assignment_is_not_set : given.assignment_validators
{
    Task Because() => Validate(AIProviderId.NotSet, AIProviderPoolId.NotSet);

    [Fact] void should_accept_the_assignment() => _results.ShouldEachConformTo(result => result.IsValid);
}
