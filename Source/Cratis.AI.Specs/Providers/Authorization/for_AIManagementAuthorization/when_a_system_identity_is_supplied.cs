// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;
using Cratis.Arc.Authorization;

namespace Cratis.AI.Providers.Authorization.for_AIManagementAuthorization;

public class when_a_system_identity_is_supplied : Specification
{
    bool _authorized;

    async Task Because()
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, SystemPrincipal.Subject)], SystemPrincipal.AuthenticationType));
        var policy = new AIManagementAuthorization(new DenyAIAdministrators());
        _authorized = await policy.IsAuthorized(new(principal, typeof(AIManagementAuthorization), new object()), CancellationToken.None);
    }

    [Fact] void should_require_administrator_authority() => _authorized.ShouldBeFalse();
}
