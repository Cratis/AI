// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;
using Cratis.Arc.Authorization;

namespace Cratis.AI.Providers.Authorization.for_AIManagementAuthorization.given;

public class a_management_policy : Specification
{
    protected IAIAdministrators _administrators;
    protected AIManagementAuthorization _policy;
    protected ClaimsPrincipal _principal;
    protected bool _authorized;

    void Establish()
    {
        _administrators = Substitute.For<IAIAdministrators>();
        _policy = new(_administrators);
        _principal = new(new ClaimsIdentity([new Claim(ClaimTypes.Role, "Member")], "test"));
        _administrators.IsAdministrator(Arg.Any<ClaimsPrincipal>(), Arg.Any<CancellationToken>())
            .Returns(call => ValueTask.FromResult(call.Arg<ClaimsPrincipal>().IsInRole("Administrator")));
    }

    protected async Task Evaluate() => _authorized = await _policy.IsAuthorized(new(_principal, typeof(AIManagementAuthorization), new object()), CancellationToken.None);
}
