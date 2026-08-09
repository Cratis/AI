// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Hosting.for_OrleansOptions.when_binding_from_configuration;

public class and_nothing_is_configured : given.a_configuration
{
    OrleansOptions _options;

    void Because() => _options = OrleansOptions.From(Configuration);

    [Fact] void should_enable_the_silo() => _options.Enabled.ShouldBeTrue();
    [Fact] void should_cluster_on_localhost() => _options.Clustering.ShouldEqual(ClusteringMode.Localhost);
}
#endif
