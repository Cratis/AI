// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.GitHub.App.for_GitHubAppTokenResolver.when_resolving_a_token;

public class and_no_installation_matches_and_none_to_fall_back_to : given.all_dependencies
{
    Exception _error;

    void Establish()
    {
        _installationsData.Add(new(111L, "Other"));
        _installationsData.Add(new(222L, "AnotherOther"));
    }

    async Task Because() => _error = await Cratis.Specifications.Catch.Exception(() => _resolver.GetToken("Cratis"));

    [Fact] void should_throw() => _error.ShouldBeOfExactType<GitHubAppNotInstalled>();
}
#endif
