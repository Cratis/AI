// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.LanguageModels;

/// <summary>
/// Represents the configuration for the Planner's own language model calls (not the worker harness),
/// bound from the <c>Planner:LanguageModel</c> configuration section.
/// </summary>
public class LanguageModelOptions
{
    /// <summary>
    /// The configuration section name the options are bound from.
    /// </summary>
    public const string SectionName = "Planner:LanguageModel";

    /// <summary>
    /// Gets or sets the Anthropic API key the Planner's own reasoning calls authenticate with - a
    /// standard API key (from the Anthropic console), not a Claude Code CLI token. Empty means the
    /// Planner has no language model to reason with: triage, plan summaries and similar features
    /// degrade to "not classified" rather than failing.
    /// </summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the model used for the Planner's own reasoning - cheap and fast is the right
    /// default, since this is classification and summarization, not implementation work.
    /// </summary>
    public string Model { get; set; } = "claude-3-5-haiku-latest";

    /// <summary>
    /// Gets or sets the base URL of the Anthropic API.
    /// </summary>
    public string ApiBaseUrl { get; set; } = "https://api.anthropic.com";

    /// <summary>
    /// Gets whether a language model is configured at all.
    /// </summary>
    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);
}
