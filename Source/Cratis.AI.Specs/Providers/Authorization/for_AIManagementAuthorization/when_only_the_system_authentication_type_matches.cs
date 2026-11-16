// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;
using Cratis.Arc.Authorization;

namespace Cratis.AI.Providers.Authorization.for_AIManagementAuthorization;

public class when_only_the_system_authentication_type_matches : given.a_management_policy
{
    void Establish() => _principal = new(new ClaimsIdentity(SystemPrincipal.AuthenticationType));
    Task Because() => Evaluate();
    [Fact] void should_deny_access() => _authorized.ShouldBeFalse();
}
