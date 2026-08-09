// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Hosting.for_OrleansOptions.when_binding_from_configuration;

public class and_the_silo_is_disabled : given.a_configuration
{
    OrleansOptions _options;

    void Establish() => _values["Planner:Orleans:Enabled"] = "false";

    void Because() => _options = OrleansOptions.From(Configuration);

    [Fact] void should_not_enable_the_silo() => _options.Enabled.ShouldBeFalse();
}
#endif
