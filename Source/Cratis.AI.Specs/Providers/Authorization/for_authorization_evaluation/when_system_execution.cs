// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;

namespace Cratis.AI.Providers.Authorization.for_authorization_evaluation;

public class when_system_execution : given.composed_management_authorization
{
    void Establish() => _principal = SystemPrincipal.WithRoles();
    Task Because() => Evaluate();
    [Fact] void should_allow_commands_and_queries() => _results.ShouldEachConformTo(result => result);
}
