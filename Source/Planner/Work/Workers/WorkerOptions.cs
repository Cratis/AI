// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Work.Workers;

/// <summary>
/// Represents the configuration for worker containers, bound from the <c>Planner:Worker</c>
/// configuration section.
/// </summary>
public class WorkerOptions
{
    /// <summary>
    /// The configuration section name the options are bound from.
    /// </summary>
    public const string SectionName = "Planner:Worker";

    /// <summary>
    /// Gets or sets the worker container image - the image built from <c>Source/Claude</c>.
    /// </summary>
    public string Image { get; set; } = "cratis/planner-worker:latest";

    /// <summary>
    /// Gets or sets the base URL workers report progress back to - must be reachable from inside a
    /// container, so locally this is the host as the container sees it.
    /// </summary>
    public string CallbackBaseUrl { get; set; } = "http://host.docker.internal:5200";
}
