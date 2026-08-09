// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.GitHub.GitIdentity.Setting;

namespace Planner.GitHub.GitIdentity.Listing.for_ConfiguredGitIdentity.when_projecting;

public class and_identity_is_set : Specification
{
    ReadModelScenario<ConfiguredGitIdentity> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(GitIdentityId.Default)
            .Events(new GitIdentitySet("Cratis Planner", "planner@cratis.io"));

    [Fact] void should_hold_the_name() => _scenario.Instance.Name.ShouldEqual(new GitUserName("Cratis Planner"));
    [Fact] void should_hold_the_email() => _scenario.Instance.Email.ShouldEqual(new GitUserEmail("planner@cratis.io"));
}
#endif
