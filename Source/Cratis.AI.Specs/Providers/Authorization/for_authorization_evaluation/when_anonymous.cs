// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;

namespace Cratis.AI.Providers.Authorization.for_authorization_evaluation;

public class when_anonymous : given.composed_management_authorization
{
    void Establish() => _principal = new(new ClaimsIdentity());
    Task Because() => Evaluate();
    [Fact] void should_deny_commands_and_queries() => _results.ShouldEachConformTo(result => !result);
}
