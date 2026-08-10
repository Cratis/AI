// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.GitHub.App.for_GitHubAppEndpoints;

public class when_building_the_registration_url : Specification
{
    Uri _forAnOrganization;
    Uri _forNoOrganization;

    void Because()
    {
        _forAnOrganization = GitHubAppEndpoints.RegistrationUrlFor("Cratis");
        _forNoOrganization = GitHubAppEndpoints.RegistrationUrlFor(string.Empty);
    }

    [Fact]
    void should_register_under_the_organization() =>
        _forAnOrganization.ToString().ShouldEqual("https://github.com/organizations/Cratis/settings/apps/new");

    [Fact]
    void should_fall_back_to_a_personal_app() =>
        _forNoOrganization.ToString().ShouldEqual("https://github.com/settings/apps/new");
}
#endif
