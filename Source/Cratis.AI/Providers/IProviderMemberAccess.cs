// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>Checks current provider access for the ambient work initiator at a dispatch boundary.</summary>
public interface IProviderMemberAccess
{
    /// <summary>Re-reads the provider's authoritative access state, denying missing providers.</summary>
    /// <param name="provider">The provider about to receive work.</param>
    /// <returns>Whether the current initiator may use it.</returns>
    Task<bool> IsAllowed(AIProviderId provider);
}
