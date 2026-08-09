// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Nodes;

namespace Planner.GitHub.App;

/// <summary>
/// Builds the GitHub App manifest submitted through GitHub's manifest-flow registration - see
/// <see href="https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest"/>.
/// </summary>
public static class GitHubAppManifest
{
    /// <summary>
    /// Builds the manifest JSON for registering the Planner as a GitHub App.
    /// </summary>
    /// <param name="callbackBaseUrl">The Planner's own publicly reachable base URL.</param>
    /// <returns>The manifest as a JSON string.</returns>
    public static string Build(string callbackBaseUrl)
    {
        var baseUrl = callbackBaseUrl.TrimEnd('/');
        var manifest = new JsonObject
        {
            ["name"] = "Cratis Planner",
            ["url"] = baseUrl,
            ["hook_attributes"] = new JsonObject { ["url"] = $"{baseUrl}/webhooks/github" },
            ["redirect_url"] = $"{baseUrl}/github-app/created",
            ["setup_url"] = $"{baseUrl}/github-app/installed",
            ["public"] = false,
            ["default_permissions"] = new JsonObject
            {
                ["contents"] = "write",
                ["issues"] = "write",
                ["pull_requests"] = "write",
                ["metadata"] = "read",
                ["members"] = "read",
            },
            ["default_events"] = new JsonArray("issues", "issue_comment", "repository", "installation", "pull_request"),
        };

        return manifest.ToJsonString();
    }
}
