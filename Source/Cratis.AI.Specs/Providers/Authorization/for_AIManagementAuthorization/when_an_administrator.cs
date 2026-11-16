// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;

namespace Cratis.AI.Providers.Authorization.for_AIManagementAuthorization;

public class when_an_administrator : given.a_management_policy
{
    void Establish() => _principal = new(new ClaimsIdentity([new Claim(ClaimTypes.Role, "Administrator")], "test"));
    Task Because() => Evaluate();
    [Fact] void should_allow_access() => _authorized.ShouldBeTrue();
}
