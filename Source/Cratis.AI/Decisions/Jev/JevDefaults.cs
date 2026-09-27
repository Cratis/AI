// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Decisions.Jev;

/// <summary>
/// What a Jev decision engine is reached with when nothing more specific is configured.
/// </summary>
public static class JevDefaults
{
    /// <summary>
    /// TypeSafe AI's own API. OpenRouter and Vercel's AI Gateway serve the same request format on
    /// their own base addresses, which is why the endpoint is configurable at all.
    /// </summary>
    public static readonly DecisionEngineEndpoint Endpoint = new("https://api.typesafe.ai");

    /// <summary>
    /// The alias that always resolves to the newest Jev release. Pin a version such as
    /// <c>jev-1.13.0</c> instead when thresholds are tuned against a specific release.
    /// </summary>
    public static readonly ModelName Model = new("jev-latest");
}
