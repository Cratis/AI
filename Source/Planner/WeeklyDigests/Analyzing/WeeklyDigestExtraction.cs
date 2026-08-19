// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Nodes;

namespace Planner.WeeklyDigests.Analyzing;

/// <summary>
/// The structured extraction parsed out of a language model's weekly digest response.
/// </summary>
/// <param name="Themes">The extracted themes.</param>
/// <param name="Description">The suggested description.</param>
public record WeeklyDigestExtraction(IEnumerable<string> Themes, WeeklyDigestDescription Description)
{
    /// <summary>
    /// Parses a language model's response into a structured extraction. Tolerant of the model
    /// wrapping the JSON in a markdown code fence.
    /// </summary>
    /// <param name="text">The language model's response text.</param>
    /// <returns>The <see cref="WeeklyDigestExtraction"/>, or <see langword="null"/> when it could not be parsed.</returns>
    public static WeeklyDigestExtraction? Parse(string text)
    {
        var start = text.IndexOf('{');
        var end = text.LastIndexOf('}');
        if (start < 0 || end <= start || JsonNode.Parse(text[start..(end + 1)]) is not JsonObject json)
        {
            return null;
        }

        var themes = json["themes"] is JsonArray themeArray
            ? themeArray.Select(theme => theme?.GetValue<string>() ?? string.Empty).Where(theme => !string.IsNullOrWhiteSpace(theme)).ToList()
            : [];

        var description = json["description"]?.GetValue<string>() ?? string.Empty;
        return string.IsNullOrWhiteSpace(description) ? null : new WeeklyDigestExtraction(themes, description);
    }
}
