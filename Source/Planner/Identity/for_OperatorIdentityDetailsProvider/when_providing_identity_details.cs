// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Arc.Identity;

namespace Planner.Identity.for_OperatorIdentityDetailsProvider;

public class when_providing_identity_details : Specification
{
    readonly OperatorIdentityDetailsProvider _provider = new();

    [Fact]
    async Task should_extract_the_login_from_the_preferred_username_claim()
    {
        var context = new IdentityProviderContext(
            "sub-id",
            "Display Name",
            [new(ProxyIdentity.LoginClaimType, "octocat")]);

        var result = await _provider.Provide(context);

        ((OperatorDetails)result.Details).Login.ShouldEqual(new UserName("octocat"));
    }

    [Fact]
    async Task should_fall_back_to_the_context_name_when_the_claim_is_absent()
    {
        var context = new IdentityProviderContext("sub-id", "octocat", []);

        var result = await _provider.Provide(context);

        ((OperatorDetails)result.Details).Login.ShouldEqual(new UserName("octocat"));
    }

    [Fact]
    async Task should_authorize_the_operator()
    {
        var context = new IdentityProviderContext("sub-id", "octocat", []);

        var result = await _provider.Provide(context);

        result.IsUserAuthorized.ShouldBeTrue();
    }

    [Fact]
    async Task should_pass_through_the_local_development_login_unchanged()
    {
        var context = new IdentityProviderContext(
            IdentityId.Empty,
            "unknown",
            [new(ProxyIdentity.LoginClaimType, ProxyIdentity.LocalOperator)]);

        var result = await _provider.Provide(context);

        ((OperatorDetails)result.Details).Login.ShouldEqual(new UserName(ProxyIdentity.LocalOperator));
    }
}
#endif
