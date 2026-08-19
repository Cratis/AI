// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.GitHub.GitIdentity;

namespace Planner.GitHub;

/// <summary>
/// The Planner's own identity on GitHub - the name every comment, issue and pull request it or a
/// worker produces should be recognizable under. Named for the person who works the show from
/// behind the scenes so it never gets seen, in the same theatre vocabulary as the rest of Cratis
/// (Chronicle, Stage, Scene, Screenplay, Prologue, Narrator, Prompter).
/// </summary>
public static class AIIdentity
{
    /// <summary>
    /// The display name every comment, commit and pull request should be recognizable under -
    /// makes the AI nature explicit rather than reading like a person's name.
    /// </summary>
    public const string DisplayName = "Stagehand (AI)";

    /// <summary>
    /// The default <see cref="GitUserName"/> worker containers commit as when no git identity has
    /// been configured - a fresh deployment should never be stuck without one.
    /// </summary>
    public static readonly GitUserName DefaultGitUserName = new(DisplayName);

    /// <summary>
    /// The default <see cref="GitUserEmail"/> worker containers commit as when no git identity has
    /// been configured - a GitHub-style noreply address, so it can never receive mail meant for a
    /// real person.
    /// </summary>
    public static readonly GitUserEmail DefaultGitUserEmail = new("stagehand-ai@users.noreply.github.com");

    /// <summary>
    /// The footer appended to every comment, issue body and pull request description the Planner or
    /// a worker writes, so it is unmistakably AI-authored wherever it shows up on GitHub.
    /// </summary>
    /// <returns>The markdown footer.</returns>
    public static string Footer() => $"\n\n---\n_Posted by {DisplayName} - an autonomous agent, not a person. Review accordingly._";
}
