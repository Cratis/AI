// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;
using Cratis.Arc.Authorization;

namespace Cratis.AI.Providers.Authorization.for_DenyAIAdministrators;

public class when_checking_principals : Specification
{
    readonly List<bool> _results = [];

    async Task Because()
    {
        var authority = new DenyAIAdministrators();
        foreach (var principal in (ClaimsPrincipal[])[new(new ClaimsIdentity()), new(new ClaimsIdentity("test")), SystemPrincipal.WithRoles(), new(new ClaimsIdentity([new Claim(ClaimTypes.Role, "Administrator")], "test"))])
        {
            _results.Add(await authority.IsAdministrator(principal, CancellationToken.None));
        }
    }

    [Fact] void should_deny_every_principal() => _results.ShouldEachConformTo(result => !result);
}
