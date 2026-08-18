// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Arc.Authorization;
using Cratis.Arc.Http;
using Cratis.Types;
using Planner.Issues.Listing;

namespace Planner.Identity.for_DenyByDefaultAuthorization.when_authorizing_a_real_query_method_through_the_composed_evaluator;

/// <summary>
/// Drives the real, production <see cref="AuthorizationEvaluator"/> - the exact class
/// <see cref="Cratis.Arc.Queries.ModelBound.ModelBoundQueryPerformer.IsAuthorized(Cratis.Arc.Queries.QueryContext)"/>
/// delegates to for every query, including the observable-query WebSocket transport that motivated this
/// evaluator - against a real, shipped query method with no request behind it at all: no HTTP request in
/// progress, no system-execution override established either.
/// </summary>
/// <remarks>
/// The query-side analogue of
/// <c>for_DenyByDefaultAuthorization.when_executing_through_the_real_pipeline.and_the_command_carries_no_authorize_attribute</c>,
/// built by hand because no query-side scenario harness exists to drive it - see the remarks on
/// <c>when_evaluating_a_type_or_method.and_a_real_query_method_carries_no_attribute</c> for what is and
/// is not proven here versus a true end-to-end query spec.
/// </remarks>
public class and_no_principal_is_established : Specification
{
    AuthorizationEvaluator _evaluator;
    bool _result;

    void Establish()
    {
        var requestContextAccessor = Substitute.For<IHttpRequestContextAccessor>();

        // Both discovered the same way Arc discovers them in production - IInstancesOf<T> by
        // reflection - so this is the real, composed evaluator chain, not a stand-in for it.
        // KnownInstancesOf<T> is Cratis.Fundamentals' own spec-oriented IInstancesOf<T> - "useful for
        // specs, as they need a predictable setup and outcome" (see its XML doc).
        _evaluator = new(
            new CurrentPrincipalAccessor(requestContextAccessor),
            new KnownInstancesOf<IAnonymousEvaluator>(new AnonymousEvaluator()),
            new KnownInstancesOf<IAuthorizationAttributeEvaluator>(new AuthorizationAttributeEvaluator(), new DenyByDefaultAuthorization()));
    }

    // Issue.AllIssues carries no [Authorize]/[AllowAnonymous] of its own - exactly the surface
    // DenyByDefaultAuthorization exists to close.
    void Because() => _result = _evaluator.IsAuthorized(typeof(Issue).GetMethod(nameof(Issue.AllIssues))!);

    [Fact] void should_not_be_authorized() => _result.ShouldBeFalse();
}
#endif
