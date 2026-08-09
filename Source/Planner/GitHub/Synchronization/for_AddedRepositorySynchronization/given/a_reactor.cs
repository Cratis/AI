// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Chronicle.Testing.Reactors;

namespace Planner.GitHub.Synchronization.for_AddedRepositorySynchronization.given;

public class a_reactor : Specification
{
    protected IIssueSynchronizer _synchronizer;
    protected ReactorScenario<AddedRepositorySynchronization> _scenario;

    void Establish()
    {
        _synchronizer = Substitute.For<IIssueSynchronizer>();
        _scenario = new(services => services.AddSingleton(_synchronizer));
    }
}
#endif
