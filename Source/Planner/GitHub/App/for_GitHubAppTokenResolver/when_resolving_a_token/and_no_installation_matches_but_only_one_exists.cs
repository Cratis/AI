// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.GitHub.App.for_GitHubAppTokenResolver.when_resolving_a_token;

public class and_no_installation_matches_but_only_one_exists : given.all_dependencies
{
    string _token;

    void Establish() => _installationsData.Add(new(111L, "Other"));

    async Task Because() => _token = await _resolver.GetToken("Cratis");

    [Fact] void should_fall_back_to_the_only_installation() => _token.ShouldEqual("installation-token");

    [Fact]
    async Task should_mint_the_token_for_that_installation() =>
        await _appClient.Received(1).GetInstallationToken(new InstallationId(111L), Arg.Any<CancellationToken>());
}
#endif
