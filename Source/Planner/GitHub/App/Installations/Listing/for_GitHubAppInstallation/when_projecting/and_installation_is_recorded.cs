// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.GitHub.App.Installations.Listing.for_GitHubAppInstallation.when_projecting;

public class and_installation_is_recorded : Specification
{
    static readonly InstallationId _installationId = 123456L;

    ReadModelScenario<GitHubAppInstallation> _scenario;

    void Establish() => _scenario = new();

    async Task Because() => await _scenario.Given.ForEventSource(_installationId).Events(new GitHubAppInstalled("Cratis"));

    [Fact] void should_hold_the_account() => _scenario.Instance.Account.ShouldEqual(new OrganizationName("Cratis"));
}
#endif
