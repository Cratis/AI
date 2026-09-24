// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Pools.Listing;

namespace Cratis.AI.Providers.Pools.for_PoolDispatcher.given;

public class all_dependencies : Specification
{
    protected static readonly AIProviderId _first = AIProviderId.New();
    protected static readonly AIProviderId _second = AIProviderId.New();

    protected static readonly AIProviderPoolMember _firstMember = new(_first);
    protected static readonly AIProviderPoolMember _secondMember = new(_second);

    protected IRecentProviderFailures _failureMemory;
    protected PoolSelectionData _selection;
    protected List<AIProviderId> _tried;

    void Establish()
    {
        _failureMemory = Substitute.For<IRecentProviderFailures>();
        _selection = new(
            new Dictionary<AIProviderId, long>(),
            new Dictionary<AIProviderId, int>(),
            new Dictionary<AIProviderId, int>(),
            new Dictionary<AIProviderId, long>());
        _tried = [];
    }
}
