// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.GitHub.App.for_GitHubAppTokenResolver.when_resolving_a_token;

public class and_no_app_is_configured : given.all_dependencies
{
    Exception _error;

    void Establish()
    {
        _options.AppId = string.Empty;
        _options.PrivateKeyPem = string.Empty;
    }

    async Task Because() => _error = await Cratis.Specifications.Catch.Exception(() => _resolver.GetToken("Cratis"));

    [Fact] void should_say_the_app_is_not_configured() => _error.ShouldBeOfExactType<GitHubAppNotConfigured>();
}
#endif
