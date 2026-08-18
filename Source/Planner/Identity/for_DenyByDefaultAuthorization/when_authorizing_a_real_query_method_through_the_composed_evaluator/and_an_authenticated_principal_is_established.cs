// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using System.Security.Claims;
using Cratis.Arc.Authorization;
using Cratis.Arc.Http;
using Cratis.Types;
using Planner.Issues.Listing;

namespace Planner.Identity.for_DenyByDefaultAuthorization.when_authorizing_a_real_query_method_through_the_composed_evaluator;

/// <summary>
/// The other half of the proof alongside <see cref="and_no_principal_is_established"/>: the same real,
/// composed <see cref="AuthorizationEvaluator"/> allows the identical query method once a real,
/// non-system authenticated caller is present - proving the denial proven there is about the missing
/// principal, not a mistake that would refuse everyone regardless of who is asking.
/// </summary>
public class and_an_authenticated_principal_is_established : Specification
{
    AuthorizationEvaluator _evaluator;
    bool _result;

    void Establish()
    {
        // A real, non-system authenticated operator - the same shape ProxyIdentity builds from a
        // forwarded-user header.
        var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Name, "jane")], "Test"));
        var requestContext = Substitute.For<IHttpRequestContext>();
        requestContext.User.Returns(principal);
        var requestContextAccessor = Substitute.For<IHttpRequestContextAccessor>();
        requestContextAccessor.Current.Returns(requestContext);

        _evaluator = new(
            new CurrentPrincipalAccessor(requestContextAccessor),
            new KnownInstancesOf<IAnonymousEvaluator>(new AnonymousEvaluator()),
            new KnownInstancesOf<IAuthorizationAttributeEvaluator>(new AuthorizationAttributeEvaluator(), new DenyByDefaultAuthorization()));
    }

    void Because() => _result = _evaluator.IsAuthorized(typeof(Issue).GetMethod(nameof(Issue.AllIssues))!);

    [Fact] void should_be_authorized() => _result.ShouldBeTrue();
}
#endif
