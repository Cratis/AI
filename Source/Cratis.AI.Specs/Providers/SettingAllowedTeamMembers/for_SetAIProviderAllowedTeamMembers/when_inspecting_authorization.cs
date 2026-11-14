// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;

namespace Cratis.AI.Providers.SettingAllowedTeamMembers.for_SetAIProviderAllowedTeamMembers;

public class when_inspecting_authorization : Specification
{
    [Fact] void should_require_authentication() => Attribute.IsDefined(typeof(SetAIProviderAllowedTeamMembers), typeof(AuthorizeAttribute)).ShouldBeTrue();
}
