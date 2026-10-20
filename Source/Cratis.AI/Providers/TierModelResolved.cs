// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers;

/// <summary>
/// The effective model for a capability tier, with the reason for a refusal or a borrowed rung.
/// </summary>
/// <param name="Tier">The requested capability tier.</param>
/// <param name="Model">The usable model, or <see cref="ModelName.NotSet"/> when refused.</param>
/// <param name="Source">How the tier resolved.</param>
/// <param name="Reason">Why the tier is unsatisfied or borrowed; empty for other sources.</param>
public record TierModelResolved(ModelTier Tier, ModelName Model, TierModelSource Source, string Reason);
