// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;

namespace LearningPath.Production.Carts.SuiteHidden;

public class when_anonymous_caller_archives : given.a_cart_command_scenario<ArchiveCart>
{
    void Establish() => _principal.Current.Returns((ClaimsPrincipal)null);
    async Task Because() => _result = await _scenario.Execute(new ArchiveCart(_cartId));
    [Fact] void should_deny() => _result.ShouldNotBeAuthorized();
    [Fact] void should_append_nothing() => _scenario.AppendedEvents.Count.ShouldEqual(0);
}

public class when_member_archives : given.a_cart_command_scenario<ArchiveCart>
{
    async Task Because() => _result = await _scenario.Execute(new ArchiveCart(_cartId));
    [Fact] void should_deny() => _result.ShouldNotBeAuthorized();
    [Fact] void should_append_nothing() => _scenario.AppendedEvents.Count.ShouldEqual(0);
}

public class when_manager_archives : given.a_cart_command_scenario<ArchiveCart>
{
    void Establish() => _principal.Current.Returns(new ClaimsPrincipal(new ClaimsIdentity(
        [new Claim(ClaimTypes.NameIdentifier, "manager"), new Claim(ClaimTypes.Role, "CartManager")], "spec")));
    async Task Because() => _result = await _scenario.Execute(new ArchiveCart(_cartId));
    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] async Task should_append() => await _scenario.ShouldHaveAppendedEvent<ArchiveCart, CartArchived>(_cartId);
}
