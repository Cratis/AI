// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Text.Json.Nodes;
using Planner.GitHub.App.Installations;

namespace Planner.GitHub.App;

/// <summary>
/// The transport boundary the GitHub App manifest-flow registration and installation setup redirect
/// through - see <see cref="GitHubAppManifest"/> for what gets submitted to GitHub.
/// </summary>
public static class GitHubAppEndpoints
{
    /// <summary>
    /// Maps the GitHub App registration and installation endpoints.
    /// </summary>
    /// <param name="app">The <see cref="WebApplication"/> to map on.</param>
    /// <returns>The same <see cref="WebApplication"/> for chaining.</returns>
    public static WebApplication MapGitHubAppEndpoints(this WebApplication app)
    {
        // The manifest is built from the origin this request came in on, never from a configured
        // address: every URL in it is one GitHub sends the operator's browser to, and the Planner's
        // configured worker callback URL is an in-cluster name no browser can resolve.
        app.MapGet("/github-app/start", (HttpRequest request) =>
        {
            var manifest = GitHubAppManifest.Build(RequestOrigin.From(request));
            return Results.Content(SelfSubmittingManifestForm(manifest), "text/html");
        });

        app.MapGet("/github-app/created", async (HttpRequest request, IHttpClientFactory httpClientFactory, CancellationToken cancellationToken) =>
        {
            var code = request.Query["code"].ToString();
            if (string.IsNullOrEmpty(code))
            {
                return Results.BadRequest();
            }

            using var client = httpClientFactory.CreateClient(GitHubServiceCollectionExtensions.ManifestHttpClientName);
            using var response = await client.PostAsync(new Uri($"app-manifests/{code}/conversions", UriKind.Relative), content: null, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return Results.Problem("Could not exchange the manifest code with GitHub - it may have already been used or expired.");
            }

            var payload = JsonNode.Parse(await response.Content.ReadAsStringAsync(cancellationToken)) as JsonObject;
            return Results.Content(CredentialsPage(payload), "text/html");
        });

        app.MapGet("/github-app/installed", async (
            HttpRequest request,
            ICommandPipeline commandPipeline,
            IGitHubAppClient appClient,
            CancellationToken cancellationToken) =>
        {
            if (!long.TryParse(request.Query["installation_id"], out var installationIdValue))
            {
                return Results.BadRequest();
            }

            InstallationId installation = installationIdValue;
            var account = await appClient.GetInstallationAccount(installation, cancellationToken);
            await commandPipeline.Execute(new RecordGitHubAppInstallation(installation, account));

            return Results.Redirect("/settings/github");
        });

        return app;
    }

    static string SelfSubmittingManifestForm(string manifest) => $"""
        <!doctype html>
        <html>
        <body onload="document.forms[0].submit()">
            <form method="post" action="https://github.com/settings/apps/new">
                <input type="hidden" name="manifest" value="{WebUtility.HtmlEncode(manifest)}" />
            </form>
            <p>Redirecting to GitHub&hellip;</p>
        </body>
        </html>
        """;

    static string CredentialsPage(JsonObject? payload)
    {
        var appId = payload?["id"]?.GetValue<long>().ToString() ?? string.Empty;
        var slug = payload?["slug"]?.GetValue<string>() ?? string.Empty;
        var name = payload?["name"]?.GetValue<string>() ?? string.Empty;
        var privateKey = payload?["pem"]?.GetValue<string>() ?? string.Empty;
        var webhookSecret = payload?["webhook_secret"]?.GetValue<string>() ?? string.Empty;

        return $"""
            <!doctype html>
            <html>
            <body style="font-family: sans-serif; max-width: 48rem; margin: 2rem auto;">
                <h1>GitHub App created</h1>
                <p>Add the following as configuration - environment variables (<code>Planner__GitHubApp__*</code>),
                user secrets locally, or a Kubernetes secret in production - then restart the Planner:</p>
                <pre style="white-space: pre-wrap; background: #f0f0f0; padding: 1rem;">
            Planner__GitHubApp__AppId={WebUtility.HtmlEncode(appId)}
            Planner__GitHubApp__Slug={WebUtility.HtmlEncode(slug)}
            Planner__GitHubApp__Name={WebUtility.HtmlEncode(name)}
            Planner__GitHubApp__WebhookSecret={WebUtility.HtmlEncode(webhookSecret)}
            Planner__GitHubApp__PrivateKeyPem={WebUtility.HtmlEncode(privateKey)}
                </pre>
                <p>Once configured, come back to <a href="/settings/github">GitHub settings</a> and install the App
                on your organization.</p>
            </body>
            </html>
            """;
    }
}
