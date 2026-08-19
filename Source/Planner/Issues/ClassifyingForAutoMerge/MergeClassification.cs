// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Nodes;

namespace Planner.Issues.ClassifyingForAutoMerge;

/// <summary>
/// The structured verdict parsed out of a language model's merge-safety classification.
/// </summary>
/// <param name="MergeableNow">Whether the language model judged this safe for an agent to merge on its own.</param>
/// <param name="Reason">Why, in either direction.</param>
public record MergeClassification(bool MergeableNow, string Reason)
{
    /// <summary>
    /// Parses a language model's response into a structured verdict. Tolerant of the model wrapping
    /// the JSON in a markdown code fence.
    /// </summary>
    /// <param name="text">The language model's response text.</param>
    /// <returns>The <see cref="MergeClassification"/>, or <see langword="null"/> when it could not be parsed.</returns>
    public static MergeClassification? Parse(string text)
    {
        var start = text.IndexOf('{');
        var end = text.LastIndexOf('}');
        if (start < 0 || end <= start || JsonNode.Parse(text[start..(end + 1)]) is not JsonObject json)
        {
            return null;
        }

        var verdict = json["verdict"]?.GetValue<string>()?.ToLowerInvariant();
        var reason = json["reason"]?.GetValue<string>() ?? string.Empty;
        return new MergeClassification(verdict == "mergeable-now", reason);
    }
}
