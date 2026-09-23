// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions;

/// <summary>
/// Settings for how the package talks to a decision provider. Deliberately transport and telemetry
/// only - nothing here says what a confident decision is, which is consumer policy.
/// </summary>
public class DecisionOptions
{
    /// <summary>
    /// The configuration section these options bind from.
    /// </summary>
    public const string SectionName = "Cratis:AI:Decisions";

    /// <summary>
    /// Gets or sets how long a single decision call may take before it is abandoned.
    /// </summary>
    /// <remarks>
    /// Short on purpose. A decision exists to be cheaper than the generative call it replaces, so a
    /// decision that takes longer than a few seconds has already lost its reason to exist and the
    /// caller is better served falling back.
    /// </remarks>
    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(5);

    /// <summary>
    /// Gets or sets how many choices a single request may carry.
    /// </summary>
    public int MaxChoices { get; set; } = 32;

    /// <summary>
    /// Gets or sets how many requests may be sent in a single batch.
    /// </summary>
    public int MaxBatchSize { get; set; } = 32;

    /// <summary>
    /// Gets or sets a value indicating whether the context text is recorded in telemetry.
    /// </summary>
    /// <remarks>
    /// Off by default. Context carries whatever the calling workflow put in it - issue bodies,
    /// source excerpts, operational detail - and that is not something a package should start
    /// exporting to a tracing backend because nobody remembered to turn it off.
    /// </remarks>
    public bool RecordContextInTelemetry { get; set; }
}
