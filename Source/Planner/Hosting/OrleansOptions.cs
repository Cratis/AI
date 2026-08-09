// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Hosting;

/// <summary>
/// Represents the Planner's choices for the co-hosted Orleans silo, bound from the
/// <c>Planner:Orleans</c> configuration section.
/// </summary>
/// <remarks>
/// These deliberately do not live under the <c>Orleans</c> section: Orleans binds that section
/// itself and reads <c>Orleans:Clustering</c> as the name of a registered clustering provider, so
/// anything the Planner puts there collides with it and fails silo construction.
/// </remarks>
public class OrleansOptions
{
    /// <summary>
    /// The configuration section name the options are bound from.
    /// </summary>
    public const string SectionName = "Planner:Orleans";

    /// <summary>
    /// Gets or sets a value indicating whether the co-hosted silo is started at all.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Gets or sets how the silo discovers its cluster and where it keeps its reminders.
    /// </summary>
    public ClusteringMode Clustering { get; set; } = ClusteringMode.Localhost;

    /// <summary>
    /// Binds the options from configuration, falling back to the defaults when the section is absent.
    /// </summary>
    /// <param name="configuration">The <see cref="IConfiguration"/> to bind from.</param>
    /// <returns>The bound <see cref="OrleansOptions"/>.</returns>
    /// <exception cref="InvalidOperationException">Thrown when a configured value cannot be converted - an unknown clustering mode, for instance.</exception>
    public static OrleansOptions From(IConfiguration configuration) =>
        configuration.GetSection(SectionName).Get<OrleansOptions>() ?? new OrleansOptions();
}
