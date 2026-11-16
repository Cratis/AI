// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;

namespace Cratis.AI.Providers.Authorization.for_AIManagementAuthorization;

public class when_anonymous : given.a_management_policy
{
    void Establish() => _principal = new(new ClaimsIdentity());
    Task Because() => Evaluate();
    [Fact] void should_deny_access() => _authorized.ShouldBeFalse();
    [Fact] void should_not_consult_administrators() => _administrators.DidNotReceive().IsAdministrator(Arg.Any<ClaimsPrincipal>(), Arg.Any<CancellationToken>());
}
