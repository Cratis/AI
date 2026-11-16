// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Reflection;
using Cratis.Arc.Authorization;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Queries.ModelBound;

namespace Cratis.AI.Providers.Authorization.for_ai_endpoints;

public class when_inspecting_authorization : Specification
{
    Type[] _endpoints;
    MethodInfo[] _queries;

    void Because()
    {
        var types = typeof(AIManagementPolicy).Assembly.GetTypes();
        _endpoints = types.Where(type => type.IsDefined(typeof(CommandAttribute)) || type.IsDefined(typeof(ReadModelAttribute))).ToArray();
        _queries = types.Where(type => type.IsDefined(typeof(ReadModelAttribute)))
            .SelectMany(type => type.GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.DeclaredOnly)).ToArray();
    }

    [Fact] void should_find_the_endpoint_inventory() => _endpoints.Length.ShouldBeGreaterThanOrEqual(75);
    [Fact] void should_find_the_query_inventory() => _queries.Length.ShouldBeGreaterThanOrEqual(19);

    [Fact] void should_require_the_management_policy_on_every_endpoint() => _endpoints.ShouldEachConformTo(type => HasManagementPolicy(type));

    [Fact] void should_require_the_management_policy_on_every_declared_query() => _queries.ShouldEachConformTo(method =>
        HasManagementPolicy(method) || HasManagementPolicy(method.DeclaringType!));

    [Fact] void should_not_allow_anonymous_endpoints() => _endpoints.ShouldEachConformTo(type => !type.IsDefined(typeof(AllowAnonymousAttribute)));

    [Fact] void should_not_allow_anonymous_endpoint_methods() => _endpoints.SelectMany(type => type.GetMethods()).Concat(_queries)
        .ShouldEachConformTo(method => !method.IsDefined(typeof(AllowAnonymousAttribute)) && !method.DeclaringType!.IsDefined(typeof(AllowAnonymousAttribute)));

    static bool HasManagementPolicy(MemberInfo target) => target.GetCustomAttributes<AuthorizeAttribute>()
        .Any(attribute => attribute.Policy == AIManagementPolicy.Name);
}
