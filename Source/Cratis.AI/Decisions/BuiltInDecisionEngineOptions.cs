// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions;

/// <summary>
/// Where the platform's own Decision Engine lives - deployment configuration, never something a
/// person using the host types in.
/// </summary>
/// <remarks>
/// The endpoint is an internal cluster address that belongs to the deployment. Asking a person to
/// enter it would turn a platform detail into a support burden and one more thing that can be typed
/// wrong, which is why choosing the built-in engine carries no settings at all.
/// </remarks>
public class BuiltInDecisionEngineOptions
{
    /// <summary>
    /// The configuration section these options bind from.
    /// </summary>
    public const string SectionName = "Cratis:AI:Decisions:BuiltIn";

    /// <summary>
    /// Gets or sets the internal endpoint of the shared Decision Engine.
    /// </summary>
    public string Endpoint { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the model the shared Decision Engine is deployed with.
    /// </summary>
    /// <remarks>
    /// For display and usage reporting only. The engine hosts exactly one loaded model, so this is
    /// never sent as a request to load a different one.
    /// </remarks>
    public string Model { get; set; } = string.Empty;

    /// <summary>
    /// Gets a value indicating whether this deployment has a built-in Decision Engine at all.
    /// </summary>
    public bool IsAvailable => !string.IsNullOrWhiteSpace(Endpoint);
}
