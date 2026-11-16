// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;

namespace Cratis.AI.Providers.Authorization.for_AIManagementAuthorization;

public class when_system_execution : given.a_management_policy
{
    void Establish() => _principal = SystemPrincipal.WithRoles();
    Task Because() => Evaluate();
    [Fact] void should_require_administrator_authority() => _authorized.ShouldBeFalse();
}
