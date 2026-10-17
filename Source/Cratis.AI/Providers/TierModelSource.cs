// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// How a provider's capability tier arrived at its model.
/// </summary>
public enum TierModelSource
{
    /// <summary>
    /// The operator's explicit mapping, checked against the catalog when one is available.
    /// </summary>
    Configured,

    /// <summary>
    /// The best conversational model on the tier's own catalog rung.
    /// </summary>
    Derived,

    /// <summary>
    /// A conversational model borrowed from another catalog rung.
    /// </summary>
    Borrowed,

    /// <summary>
    /// An official Claude Code alias for a subscription without a catalog, not an entitlement check.
    /// </summary>
    SubscriptionAlias,

    /// <summary>
    /// No model can serve the tier under the provider's mapping and catalog.
    /// </summary>
    Unsatisfied
}
