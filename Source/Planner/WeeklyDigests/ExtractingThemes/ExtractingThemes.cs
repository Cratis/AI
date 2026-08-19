// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.WeeklyDigests.ExtractingThemes;

/// <summary>
/// Command for recording the themes the language model extracted from a weekly digest's content -
/// executed by the weekly digest analysis reactor.
/// </summary>
/// <param name="WeeklyDigest">The identity of the weekly digest.</param>
/// <param name="Themes">The themes extracted from the content.</param>
[Command]
public record ExtractWeeklyDigestThemes(WeeklyDigestId WeeklyDigest, IEnumerable<string> Themes)
{
    /// <summary>
    /// Handles the command by appending a <see cref="WeeklyDigestThemesExtracted"/> event.
    /// </summary>
    /// <returns>The event.</returns>
    public WeeklyDigestThemesExtracted Handle() => new(Themes);
}

/// <summary>
/// Event raised when themes have been extracted from a weekly digest's content.
/// </summary>
/// <param name="Themes">The themes extracted from the content.</param>
[EventType]
public record WeeklyDigestThemesExtracted(IEnumerable<string> Themes);
