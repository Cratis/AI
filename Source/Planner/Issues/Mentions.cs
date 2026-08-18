// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.RegularExpressions;

namespace Planner.Issues;

/// <summary>
/// Extracts GitHub <c>@mentions</c> from the markdown body of an issue or comment.
/// </summary>
public static partial class Mentions
{
    [GeneratedRegex(@"```.*?```", RegexOptions.Singleline, 1000)]
    private static partial Regex FencedCodeBlockExpression { get; }

    [GeneratedRegex(@"`[^`\r\n]*`", RegexOptions.None, 1000)]
    private static partial Regex InlineCodeExpression { get; }

    [GeneratedRegex(@"(?<![\w@])@(?<login>[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)(?!\w)", RegexOptions.None, 1000)]
    private static partial Regex MentionExpression { get; }

    /// <summary>
    /// Finds every GitHub login mentioned in a body of markdown text.
    /// </summary>
    /// <param name="body">The markdown text to search.</param>
    /// <returns>
    /// The mentioned logins, in first-seen order, de-duplicated case-insensitively - GitHub logins are
    /// not case-sensitive, so <c>@octocat</c> and <c>@Octocat</c> are the same mention. Mentions inside
    /// fenced code blocks or inline code are ignored, as are strings that look like an email address.
    /// </returns>
    public static IEnumerable<UserName> In(string body)
    {
        var withoutCode = InlineCodeExpression.Replace(FencedCodeBlockExpression.Replace(body, string.Empty), string.Empty);
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var mentions = new List<UserName>();

        foreach (Match match in MentionExpression.Matches(withoutCode))
        {
            var login = match.Groups["login"].Value;
            if (seen.Add(login))
            {
                mentions.Add(login);
            }
        }

        return mentions;
    }
}
