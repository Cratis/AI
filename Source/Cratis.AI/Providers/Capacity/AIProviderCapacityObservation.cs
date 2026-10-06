// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// One read of a provider's allowance, and when it was made.
/// </summary>
/// <param name="Report">What the vendor reported.</param>
/// <param name="ObservedAt">When the vendor reported it.</param>
public record AIProviderCapacityObservation(AIProviderCapacityReport Report, DateTimeOffset ObservedAt);
