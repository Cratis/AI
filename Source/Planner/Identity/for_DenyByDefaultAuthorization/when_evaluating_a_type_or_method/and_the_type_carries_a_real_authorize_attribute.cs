// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Identity.for_DenyByDefaultAuthorization.given;

namespace Planner.Identity.for_DenyByDefaultAuthorization.when_evaluating_a_type_or_method;

public class and_the_type_carries_a_real_authorize_attribute : Specification
{
    DenyByDefaultAuthorization _evaluator;
    (bool HasAuthorize, string? Roles)? _result;

    void Establish() => _evaluator = new();
    void Because() => _result = _evaluator.GetAuthorizationInfo(typeof(CommandWithAuthorize));

    // Deferring (null) rather than reporting an opinion of its own is what lets Arc's own evaluator -
    // not this one - report the real [Authorize(Roles = "Admin")]. Reporting an opinion here would risk
    // winning the race against Arc's evaluator and silently dropping the roles.
    [Fact] void should_defer_to_arcs_own_evaluator() => _result.HasValue.ShouldBeFalse();
}
#endif
