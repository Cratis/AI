// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.for_AIProviderPoolDispatcher.given;

public static class member_access
{
    public static IProviderMemberAccess Allowed()
    {
        var access = Substitute.For<IProviderMemberAccess>();
        access.IsAllowed(Arg.Any<AIProviderId>()).Returns(true);
        return access;
    }
}
