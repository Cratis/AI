// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingTierModels;

/// <summary>
/// Records the origin of an entire tier table, after its compatibility mapping event in the same append.
/// </summary>
/// <param name="Models">The complete table whose origin is recorded.</param>
/// <param name="Source">How this table was selected.</param>
[EventType]
public record AIProviderTierModelsProvenanceSet(TierModels Models, TierModelMappingSource Source);
