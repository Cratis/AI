// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Identity.for_DenyByDefaultAuthorization.given;

namespace Planner.Identity.for_DenyByDefaultAuthorization.when_evaluating_a_type_or_method;

public class and_neither_the_method_nor_its_declaring_type_carries_an_attribute : Specification
{
    DenyByDefaultAuthorization _evaluator;
    (bool HasAuthorize, string? Roles)? _result;

    void Establish() => _evaluator = new();

    void Because() => _result = _evaluator.GetAuthorizationInfo(
        typeof(CommandWithNoAttributes).GetMethod(nameof(CommandWithNoAttributes.Handle))!);

    [Fact] void should_require_authorization() => _result!.Value.HasAuthorize.ShouldBeTrue();
    [Fact] void should_not_require_a_specific_role() => _result!.Value.Roles.ShouldBeNull();
}
#endif
