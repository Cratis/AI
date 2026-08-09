// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Hosting.for_OrleansOptions.given;

public class a_configuration : Specification
{
    protected Dictionary<string, string?> _values;

    protected IConfiguration Configuration => new ConfigurationBuilder().AddInMemoryCollection(_values).Build();

    void Establish() => _values = [];
}
#endif
