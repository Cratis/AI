// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions;

/// <summary>
/// Which kind of decision engine weighs a deployment's decisions.
/// </summary>
/// <remarks>
/// Persisted in events - append new members, never renumber. Unlike language-model providers there
/// is only ever one decision engine in force, so this is a choice between engines rather than a
/// vendor tag on one of many configured providers.
/// </remarks>
public enum DecisionEngineType
{
    /// <summary>
    /// The platform's own Cratis Decision Engine, deployed alongside the host and configured at
    /// deployment time through <see cref="BuiltInDecisionEngineOptions"/>.
    /// </summary>
    BuiltIn = 0,

    /// <summary>
    /// TypeSafe AI's Jev - a hosted System One model reached with an API key.
    /// </summary>
    Jev = 1,
}
