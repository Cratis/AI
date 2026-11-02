// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.AvailableModels;

/// <summary>
/// Records a catalog capability limitation without asserting that a credential or conversation works.
/// </summary>
/// <param name="Reason">Why discovery is unavailable with the configured credentials.</param>
/// <param name="AttemptedAt">When discovery was attempted.</param>
[EventType]
public record AIProviderModelDiscoveryUnavailable(string Reason, DateTimeOffset AttemptedAt);
