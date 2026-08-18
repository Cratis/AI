// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using System.Security.Claims;
using Cratis.Arc.Http;
using Planner.Accounts;
using Planner.Accounts.Removing;

namespace Planner.Identity.for_DenyByDefaultAuthorization.when_executing_through_the_real_pipeline;

public class and_the_command_carries_authorize_and_a_principal_is_established : Specification
{
    static readonly AccountId _accountId = AccountId.New();

    CommandScenario<RemoveAccount> _scenario;
    CommandResult _result;

    void Establish()
    {
        _scenario = new();

        // A real, non-system authenticated operator - the same shape ProxyIdentity builds from a
        // forwarded-user header - distinct from the trusted-system-actor path proven separately below.
        // Replaces CommandScenarioDefaultCaller's own default principal with this one.
        var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Name, "jane")], "Test"));
        var requestContext = Substitute.For<IHttpRequestContext>();
        requestContext.User.Returns(principal);
        var requestContextAccessor = Substitute.For<IHttpRequestContextAccessor>();
        requestContextAccessor.Current.Returns(requestContext);
        _scenario.Services.AddSingleton(requestContextAccessor);
    }

    async Task Because() => _result = await _scenario.Execute(new RemoveAccount(_accountId));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] void should_append_account_removed() => _scenario.EventSequence.ShouldHaveAppendedEvent<ClaudeAccountRemoved>();
}
#endif
