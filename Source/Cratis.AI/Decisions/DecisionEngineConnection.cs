// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Decisions;

/// <summary>
/// Everything needed to reach the decision engine currently in force.
/// </summary>
/// <param name="Type">Which kind of engine it is.</param>
/// <param name="Endpoint">The base address it is reached on.</param>
/// <param name="ApiKey">The credential it is called with - <see cref="DecisionEngineApiKey.NotSet"/> when it needs none.</param>
/// <param name="Model">The model it weighs choices with.</param>
public record DecisionEngineConnection(
    DecisionEngineType Type,
    DecisionEngineEndpoint Endpoint,
    DecisionEngineApiKey ApiKey,
    ModelName Model);
