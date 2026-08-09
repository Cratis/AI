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
    /// The webhook events the App subscribes to.
    /// </summary>
    /// <remarks>
    /// Only events an App can actually be subscribed to belong here. The installation lifecycle events
    /// (<c>installation</c> and <c>installation_repositories</c>) are delivered to every App implicitly and
    /// are not subscribable - listing either one makes GitHub reject the whole manifest with
    /// <c>Default events unsupported: installation</c>, which blocks the registration entirely. The Planner
    /// still handles the <c>installation</c> deliveries in <see cref="Webhooks.GitHubWebhookEndpoints"/>;
    /// it just must not ask for them.
    /// </remarks>
    public static readonly string[] DefaultEvents = ["issues", "issue_comment", "repository", "pull_request"];

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
            ["default_events"] = new JsonArray([.. DefaultEvents.Select(@event => (JsonNode)JsonValue.Create(@event))]),
        };

        return manifest.ToJsonString();
    }
}
