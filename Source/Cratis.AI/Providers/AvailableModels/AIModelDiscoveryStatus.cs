// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.AvailableModels;

/// <summary>
/// The latest outcome of asking a provider for its catalog, not a claim about conversation health.
/// </summary>
public enum AIModelDiscoveryStatus
{
    /// <summary>No discovery has been recorded.</summary>
    NotAttempted = 0,

    /// <summary>The provider returned a catalog, possibly empty.</summary>
    Discovered = 1,

    /// <summary>The configured credential cannot support catalog discovery.</summary>
    Unavailable = 2,

    /// <summary>A catalog request failed.</summary>
    Failed = 3
}
