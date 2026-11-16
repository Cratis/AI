// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;

namespace Cratis.AI.Providers.Authorization.for_AIManagementAuthorization;

public class when_the_authority_is_unavailable : given.a_management_policy
{
    void Establish() => _administrators.IsAdministrator(Arg.Any<ClaimsPrincipal>(), Arg.Any<CancellationToken>())
        .Returns(_ => ValueTask.FromException<bool>(new AuthorityUnavailable()));
    Task Because() => Evaluate();
    [Fact] void should_deny_access() => _authorized.ShouldBeFalse();

    class AuthorityUnavailable : Exception;
}
