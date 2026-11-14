// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// Authorizes replacement of a provider's member selection. Consumers implement their own
/// administrative policy; being authenticated or selected for use does not grant this authority.
/// </summary>
public interface IProviderSelectionAuthority
{
    /// <summary>Whether the current caller may replace the selection for this provider.</summary>
    /// <param name="provider">The provider to administer.</param>
    /// <returns>Whether replacement is authorized.</returns>
    Task<bool> CanSet(AIProviderId provider);
}
