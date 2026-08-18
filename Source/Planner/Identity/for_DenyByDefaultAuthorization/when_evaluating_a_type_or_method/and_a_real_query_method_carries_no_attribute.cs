// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues.Listing;

namespace Planner.Identity.for_DenyByDefaultAuthorization.when_evaluating_a_type_or_method;

/// <summary>
/// Proves this evaluator's central claim about the query side of the surface, unit-level: unlike every
/// other spec in this folder, which checks synthetic <c>given</c> types, this one points the evaluator
/// at a real, shipped <c>[ReadModel]</c> static query method - <see cref="Issue.AllIssues"/> - that
/// carries no <see cref="Cratis.Arc.Authorization.AuthorizeAttribute"/>/<see cref="Cratis.Arc.Authorization.AllowAnonymousAttribute"/>
/// of its own.
/// </summary>
/// <remarks>
/// This is a <b>unit-level</b> proof of the evaluator alone, not an end-to-end proof of the query
/// pipeline: no <c>QueryScenario</c>-style in-process harness exists (only <c>CommandScenario</c>,
/// <c>EventScenario</c>, <c>ReadModelScenario</c> and <c>ReactorScenario</c> ship in
/// <c>Cratis.Arc.Testing</c>/<c>Cratis.Chronicle.Testing</c> at the versions this project references),
/// so nothing here drives a real query - including the observable-query WebSocket transport this
/// evaluator was written to cover - through Arc's actual authorization gate
/// (<see cref="Cratis.Arc.Queries.ModelBound.ModelBoundQueryPerformer.IsAuthorized(Cratis.Arc.Queries.QueryContext)"/>).
/// See the sibling <c>when_authorizing_a_real_query_method_through_the_composed_evaluator</c> specs for
/// how much further this can be pushed with the real, production
/// <see cref="Cratis.Arc.Authorization.AuthorizationEvaluator"/> that boundary actually delegates to.
/// </remarks>
public class and_a_real_query_method_carries_no_attribute : Specification
{
    DenyByDefaultAuthorization _evaluator;
    (bool HasAuthorize, string? Roles)? _result;

    void Establish() => _evaluator = new();

    void Because() => _result = _evaluator.GetAuthorizationInfo(
        typeof(Issue).GetMethod(nameof(Issue.AllIssues))!);

    [Fact] void should_require_authorization() => _result!.Value.HasAuthorize.ShouldBeTrue();
    [Fact] void should_not_require_a_specific_role() => _result!.Value.Roles.ShouldBeNull();
}
#endif
