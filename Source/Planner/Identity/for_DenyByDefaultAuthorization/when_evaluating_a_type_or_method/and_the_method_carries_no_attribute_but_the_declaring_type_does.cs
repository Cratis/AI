// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Identity.for_DenyByDefaultAuthorization.given;

namespace Planner.Identity.for_DenyByDefaultAuthorization.when_evaluating_a_type_or_method;

public class and_the_method_carries_no_attribute_but_the_declaring_type_does : Specification
{
    DenyByDefaultAuthorization _evaluator;
    (bool HasAuthorize, string? Roles)? _result;

    void Establish() => _evaluator = new();

    void Because() => _result = _evaluator.GetAuthorizationInfo(
        typeof(CommandWithAuthorize).GetMethod(nameof(CommandWithAuthorize.Handle))!);

    // Reporting an opinion at the method level here would stop Arc's own method-then-declaring-type
    // fallback (AuthorizationEvaluator.IsAuthorized(MethodInfo)) from ever reaching the type and its
    // real [Authorize(Roles = "Admin")] - silently downgrading it to "any authenticated caller".
    // Deferring lets the fallback run and the type's roles apply.
    [Fact] void should_defer_so_the_declaring_types_roles_are_not_masked() => _result.HasValue.ShouldBeFalse();
}
#endif
