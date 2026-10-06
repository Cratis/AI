// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// Where a provider's <see cref="AIProviderCapacity"/> came from.
/// </summary>
public enum AIProviderCapacitySource
{
    /// <summary>
    /// The vendor reported the subscription's own usage windows.
    /// </summary>
    Subscription = 0,

    /// <summary>
    /// The provider's hand-set <see cref="AIProviderUsageCapacity"/> ceiling, measured against the tokens it has consumed.
    /// </summary>
    ConfiguredCeiling = 1,

    /// <summary>
    /// Nothing that is known limits the provider.
    /// </summary>
    Unmetered = 2,

    /// <summary>
    /// The capacity could not be determined - the vendor's usage surface did not answer, for instance.
    /// </summary>
    Unknown = 3,
}
