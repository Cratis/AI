// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
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
        app.MapGet("/github-app/start", (HttpRequest request, IOptions<GitHubAppOptions> options) =>
        {
            var organization = request.Query["organization"].ToString() is { Length: > 0 } requested
                ? requested
                : options.Value.Organization;
            var manifest = GitHubAppManifest.Build(RequestOrigin.From(request), request.Query["name"].ToString());
            return Results.Content(SelfSubmittingManifestForm(manifest, organization), "text/html");
        });

        // The manifest on its own, so scripts/create-github-app.sh can drive the registration from a
        // terminal against exactly the permissions this Planner asks for - one definition, not two.
        app.MapGet("/github-app/manifest", (HttpRequest request) =>
            Results.Content(GitHubAppManifest.Build(RequestOrigin.From(request), request.Query["name"].ToString()), "application/json"));

        app.MapGet("/github-app/created", async (
            HttpRequest request,
            IHttpClientFactory httpClientFactory,
            IOptions<GitHubAppOptions> options,
            CancellationToken cancellationToken) =>
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
            return Results.Content(CredentialsPage(payload, options.Value.Organization), "text/html");
        });

        // Deliberately NOT paired with VerifiedCallerPrincipal.EstablishAsVerified() the way the
        // webhook/callback boundaries below are. Those endpoints verify their own caller (an HMAC
        // signature, a per-work bearer token) before establishing anything - this one has no
        // independent credential of its own to verify: installation_id is a bare, guessable query
        // parameter GitHub redirects the browser with, not a signed delivery. Establishing a verified
        // caller here would just recreate today's hole - anyone who can reach this URL with any
        // installation_id gets it recorded - under the new mechanism's name, while looking fixed.
        // Under deny-by-default this endpoint now fails closed instead: RecordGitHubAppInstallation
        // carries no [Authorize] of its own, so DenyByDefaultAuthorization refuses it unless
        // UsePlannerSecurity has already put an authenticated operator principal on the request (from
        // the authenticating proxy in front of the Planner, or ProxyIdentity's local-dev fallback -
        // see SecurityConfigurationExtensions). That is the correct requirement: finishing GitHub App
        // setup is an operator action reached by an operator's own browser navigating through the
        // proxy like any other page, not a delivery from GitHub itself. Consequence: a deployment
        // whose proxy does not authenticate this path (or that runs with AllowUnauthenticatedOperators
        // for a reason that does not apply here) will see this redirect fail with 401 until that is
        // fixed - the fix belongs in the proxy/deployment configuration, not in a code-level bypass.
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

    /// <summary>
    /// Builds the GitHub URL a manifest is submitted to. An organization registers the App as owned
    /// by that organization; without one GitHub creates it under the signed-in user's account.
    /// </summary>
    /// <param name="organization">The organization to register under, or empty for a personal App.</param>
    /// <returns>The registration URL.</returns>
    public static Uri RegistrationUrlFor(string organization) =>
        string.IsNullOrWhiteSpace(organization)
            ? new Uri("https://github.com/settings/apps/new")
            : new Uri($"https://github.com/organizations/{Uri.EscapeDataString(organization)}/settings/apps/new");

    static string SelfSubmittingManifestForm(string manifest, string organization) => $"""
        <!doctype html>
        <html>
        <body onload="document.forms[0].submit()">
            <form method="post" action="{WebUtility.HtmlEncode(RegistrationUrlFor(organization).ToString())}">
                <input type="hidden" name="manifest" value="{WebUtility.HtmlEncode(manifest)}" />
            </form>
            <p>Redirecting to GitHub&hellip;</p>
        </body>
        </html>
        """;

    static string CredentialsPage(JsonObject? payload, string organization)
    {
        var appId = payload?["id"]?.GetValue<long>().ToString() ?? string.Empty;
        var slug = payload?["slug"]?.GetValue<string>() ?? string.Empty;
        var name = payload?["name"]?.GetValue<string>() ?? string.Empty;
        var owner = payload?["owner"]?["login"]?.GetValue<string>() ?? organization;
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
            Planner__GitHubApp__Organization={WebUtility.HtmlEncode(owner)}
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
