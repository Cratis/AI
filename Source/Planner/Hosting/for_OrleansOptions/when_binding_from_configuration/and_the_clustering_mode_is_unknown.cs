// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Hosting.for_OrleansOptions.when_binding_from_configuration;

public class and_the_clustering_mode_is_unknown : given.a_configuration
{
    Exception _error;

    void Establish() => _values["Planner:Orleans:Clustering"] = "Mongo";

    void Because() => _error = Cratis.Specifications.Catch.Exception(() => OrleansOptions.From(Configuration));

    [Fact] void should_fail_rather_than_silently_fall_back() => _error.ShouldNotBeNull();
}
#endif
