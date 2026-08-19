// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Nodes;

namespace Planner.Issues.Triaging;

/// <summary>
/// The structured verdict parsed out of a language model's triage response.
/// </summary>
/// <param name="Kind">What kind of issue this is.</param>
/// <param name="Feasibility">Whether an agent can act on it.</param>
/// <param name="Priority">The suggested priority.</param>
/// <param name="Labels">The suggested labels.</param>
/// <param name="Area">The affected area.</param>
/// <param name="Model">The suggested model.</param>
public record TriageClassification(
    IssueKind Kind,
    IssueFeasibility Feasibility,
    Priority Priority,
    IEnumerable<LabelName> Labels,
    IssueArea Area,
    ModelName Model)
{
    /// <summary>
    /// Parses a language model's triage response into a structured classification. Tolerant of the
    /// model wrapping the JSON in a markdown code fence, since not every model follows "only JSON"
    /// literally.
    /// </summary>
    /// <param name="text">The language model's response text.</param>
    /// <returns>The <see cref="TriageClassification"/>, or <see langword="null"/> when it could not be parsed.</returns>
    public static TriageClassification? Parse(string text)
    {
        var jsonText = ExtractJson(text);
        if (jsonText is null || JsonNode.Parse(jsonText) is not JsonObject json)
        {
            return null;
        }

        var kind = json["kind"]?.GetValue<string>()?.ToLowerInvariant() switch
        {
            "bug" => IssueKind.Bug,
            "feature" => IssueKind.Feature,
            "question" => IssueKind.Question,
            "docs" => IssueKind.Docs,
            "chore" => IssueKind.Chore,
            "support" => IssueKind.Support,
            _ => IssueKind.Unclassified
        };

        var feasibility = json["feasibility"]?.GetValue<string>()?.ToLowerInvariant() switch
        {
            "agentcando" => IssueFeasibility.AgentCanDo,
            "needshumandecision" => IssueFeasibility.NeedsHumanDecision,
            "needsmoreinformation" => IssueFeasibility.NeedsMoreInformation,
            "notactionable" => IssueFeasibility.NotActionable,
            "duplicate" => IssueFeasibility.Duplicate,
            _ => IssueFeasibility.Unclassified
        };

        var priority = json["priority"]?.GetValue<string>()?.ToLowerInvariant() switch
        {
            "critical" => Priority.Critical,
            "high" => Priority.High,
            "normal" => Priority.Normal,
            "low" => Priority.Low,
            _ => Priority.NotSet
        };

        var labels = json["labels"] is JsonArray labelArray
            ? labelArray
                .Select(label => label?.GetValue<string>() ?? string.Empty)
                .Where(label => !string.IsNullOrWhiteSpace(label))
                .Select(label => new LabelName(label))
                .ToList()
            : [];

        var area = json["area"]?.GetValue<string>() ?? string.Empty;
        var model = json["model"]?.GetValue<string>() ?? string.Empty;

        return new TriageClassification(kind, feasibility, priority, labels, area, string.IsNullOrWhiteSpace(model) ? ModelName.NotSet : model);
    }

    static string? ExtractJson(string text)
    {
        var trimmed = text.Trim();
        var start = trimmed.IndexOf('{');
        var end = trimmed.LastIndexOf('}');
        return start >= 0 && end > start ? trimmed[start..(end + 1)] : null;
    }
}
