// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Hosting.for_OrleansOptions.when_binding_from_configuration;

/// <summary>
/// The <c>Orleans</c> section belongs to Orleans itself - it reads <c>Orleans:Clustering</c> as the
/// name of a registered clustering provider. Nothing the Planner decides may be read from there.
/// </summary>
public class and_the_orleans_owned_section_is_configured : given.a_configuration
{
    OrleansOptions _options;

    void Establish()
    {
        _values["Orleans:Clustering"] = "MongoDB";
        _values["Orleans:Enabled"] = "false";
    }

    void Because() => _options = OrleansOptions.From(Configuration);

    [Fact] void should_ignore_it_and_enable_the_silo() => _options.Enabled.ShouldBeTrue();
    [Fact] void should_ignore_it_and_cluster_on_localhost() => _options.Clustering.ShouldEqual(ClusteringMode.Localhost);
}
#endif
