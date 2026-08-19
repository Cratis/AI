// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Nodes;

namespace Planner.Builds.Analyzing;

/// <summary>
/// The structured verdict parsed out of a language model's build-failure assessment.
/// </summary>
/// <param name="Diagnosis">What the language model thinks is wrong.</param>
/// <param name="Fixable">Whether the language model judged an agent could plausibly fix it.</param>
public record BuildAssessment(BuildDiagnosis Diagnosis, bool Fixable)
{
    /// <summary>
    /// Parses a language model's assessment response into a structured verdict. Tolerant of the
    /// model wrapping the JSON in a markdown code fence.
    /// </summary>
    /// <param name="text">The language model's response text.</param>
    /// <returns>The <see cref="BuildAssessment"/>, or <see langword="null"/> when it could not be parsed.</returns>
    public static BuildAssessment? Parse(string text)
    {
        var start = text.IndexOf('{');
        var end = text.LastIndexOf('}');
        if (start < 0 || end <= start || JsonNode.Parse(text[start..(end + 1)]) is not JsonObject json)
        {
            return null;
        }

        var diagnosis = json["diagnosis"]?.GetValue<string>() ?? string.Empty;
        var fixable = json["fixable"]?.GetValue<bool>() ?? false;
        return new BuildAssessment(diagnosis, fixable);
    }
}
