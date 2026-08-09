// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.GitHub.App.for_GitHubAppTokenResolver.when_resolving_a_token;

public class and_an_installation_matches_the_account : given.all_dependencies
{
    string _token;

    void Establish()
    {
        _installationsData.Add(new(111L, "Other"));
        _installationsData.Add(new(222L, "Cratis"));
    }

    async Task Because() => _token = await _resolver.GetToken("Cratis");

    [Fact] void should_return_the_installation_token() => _token.ShouldEqual("installation-token");

    [Fact]
    async Task should_mint_the_token_for_the_matching_installation() =>
        await _appClient.Received(1).GetInstallationToken(new InstallationId(222L), Arg.Any<CancellationToken>());
}
#endif
