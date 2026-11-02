// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.AvailableModels;

/// <summary>
/// Records that discovery derived the provider's tier table from its catalog, after the
/// <see cref="SettingTierModels.AIProviderTierModelsSet"/> carrying that table in the same append.
/// </summary>
/// <remarks>
/// A separate fact rather than a change to the mapping event: <see cref="SettingTierModels.AIProviderTierModelsSet"/>
/// keeps its shape, and its consumers keep seeing every table. A table without this fact after it is the
/// operator's own selection, or one recorded before derivations were marked.
/// </remarks>
/// <param name="Models">The complete table discovery derived.</param>
[EventType]
public record AIProviderTierModelsDerived(TierModels Models);
