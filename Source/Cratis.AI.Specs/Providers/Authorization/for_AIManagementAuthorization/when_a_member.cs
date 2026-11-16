// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Authorization.for_AIManagementAuthorization;

public class when_a_member : given.a_management_policy
{
    Task Because() => Evaluate();
    [Fact] void should_deny_access() => _authorized.ShouldBeFalse();
}
