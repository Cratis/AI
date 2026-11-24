// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.Arc.Authorization;

namespace Cratis.AI.Usage.for_RecordAgentSessionUsage;

public class when_inspecting_authorization : Specification
{
    [Fact] void should_require_authentication() => Attribute.IsDefined(typeof(RecordAgentSessionUsage), typeof(AuthorizeAttribute)).ShouldBeTrue();
    [Fact] void should_require_the_management_policy() => ((AuthorizeAttribute)Attribute.GetCustomAttribute(typeof(RecordAgentSessionUsage), typeof(AuthorizeAttribute))!).Policy.ShouldEqual(AIManagementPolicy.Name);
}
