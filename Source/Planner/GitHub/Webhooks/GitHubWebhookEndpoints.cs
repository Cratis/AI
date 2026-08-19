// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using Planner.GitHub.App;
using Planner.GitHub.App.Installations;
using Planner.Issues.ChangingAssignees;
using Planner.Issues.ChangingBody;
using Planner.Issues.ChangingLabels;
using Planner.Issues.ChangingMilestone;
using Planner.Issues.Closing;
using Planner.Issues.Comments.Recording;
using Planner.Issues.Comments.Removing;
using Planner.Issues.Registration;
using Planner.Issues.Renaming;
using Planner.Issues.Reopening;
using Planner.PullRequests.Closing;
using Planner.PullRequests.Registration;
using Planner.PullRequests.Reopening;
using Planner.PullRequests.UpdatingDetails;
using Planner.Repositories.Adding;
using Planner.Repositories.Listing;
using Planner.Repositories.Organizations;
using OrganizationListing = Planner.Repositories.Organizations.Listing.Organization;

namespace Planner.GitHub.Webhooks;

/// <summary>
/// The transport boundary GitHub webhook deliveries arrive through. Deliveries are validated
/// against the configured GitHub App secret and translated into the Planner's commands - the main
/// mechanism keeping the issue and pull request mirrors current.
/// </summary>
public static class GitHubWebhookEndpoints
{
    /// <summary>
    /// Maps the GitHub webhook endpoint.
    /// </summary>
    /// <param name="app">The <see cref="WebApplication"/> to map on.</param>
    /// <returns>The same <see cref="WebApplication"/> for chaining.</returns>
    public static WebApplication MapGitHubWebhooks(this WebApplication app)
    {
        app.MapPost("/webhooks/github", async (
            HttpRequest request,
            ICommandPipeline commandPipeline,
            IMongoCollection<Repository> repositories,
            IMongoCollection<OrganizationListing> organizations,
            IOptions<GitHubAppOptions> options) =>
        {
            using var reader = new StreamReader(request.Body);
            var body = await reader.ReadToEndAsync();

            if (!SignatureIsValid(request, body, options.Value.WebhookSecret))
            {
                return Results.Unauthorized();
            }

            if (JsonNode.Parse(body) is not JsonObject payload)
            {
                return Results.BadRequest();
            }

            switch (request.Headers["X-GitHub-Event"].ToString())
            {
                case "issues":
                    await HandleIssueEvent(payload, commandPipeline, repositories);
                    break;

                case "issue_comment":
                    await HandleIssueCommentEvent(payload, commandPipeline, repositories);
                    break;

                case "pull_request":
                    await HandlePullRequestEvent(payload, commandPipeline, repositories);
                    break;

                case "installation":
                    await HandleInstallationEvent(payload, commandPipeline);
                    break;

                case "repository" when payload["action"]?.GetValue<string>() == "created":
                    var repository = payload["repository"] as JsonObject;
                    var owner = repository?["owner"]?["login"]?.GetValue<string>();
                    var name = repository?["name"]?.GetValue<string>();
                    if (owner is not null && name is not null && await TracksAllRepositories(organizations, owner))
                    {
                        // Only an organization tracked as "All" grows automatically - one tracked as
                        // "Selected" only gets the repositories a person explicitly picked, and a new
                        // repository showing up later is not an implicit opt-in.
                        await commandPipeline.Execute(new AddRepository(owner, name));
                    }

                    break;
            }

            return Results.Ok();
        });

        return app;
    }

    static async Task<bool> TracksAllRepositories(IMongoCollection<OrganizationListing> organizations, string owner)
    {
        var organizationId = OrganizationId.From(owner);
        var cursor = await organizations.FindAsync(organization => organization.Id == organizationId);
        var organization = await cursor.FirstOrDefaultAsync();

        // An organization the Planner does not track as such (a repository created under an account
        // whose owner was never added) has no policy to honor - default to the existing behavior.
        return organization is null || organization.TrackingPolicy == OrganizationTrackingPolicy.All;
    }

    static async Task HandleIssueEvent(JsonObject payload, ICommandPipeline commandPipeline, IMongoCollection<Repository> repositories)
    {
        if (payload["issue"] is not JsonObject issue || payload["repository"] is not JsonObject repository)
        {
            return;
        }

        OrganizationName owner = repository["owner"]?["login"]?.GetValue<string>() ?? string.Empty;
        RepositoryName name = repository["name"]?.GetValue<string>() ?? string.Empty;

        // Only mirror issues for repositories that have been added to the Planner.
        var repositoryId = RepositoryId.From(owner, name);
        var tracked = await repositories.CountDocumentsAsync(tracked => tracked.Id == repositoryId);
        if (tracked == 0)
        {
            return;
        }

        IssueNumber number = issue["number"]?.GetValue<int>() ?? 0;
        var issueId = IssueId.From(owner, name, number);

        switch (payload["action"]?.GetValue<string>())
        {
            case "opened":
                await commandPipeline.Execute(new RegisterIssue(
                    owner,
                    name,
                    number,
                    issue["title"]?.GetValue<string>() ?? string.Empty,
                    issue["type"] is JsonObject type ? type["name"]?.GetValue<string>() ?? string.Empty : string.Empty,
                    issue["user"]?["login"]?.GetValue<string>() ?? string.Empty,
                    issue["created_at"]?.GetValue<DateTimeOffset>() ?? DateTimeOffset.MinValue,
                    GitHubAuthorAssociations.Map(issue["author_association"]?.GetValue<string>()),
                    issue["state"]?.GetValue<string>() == "open",
                    issue["body"]?.GetValue<string>() ?? string.Empty,
                    ParseLabels(issue)));
                break;

            case "edited":
                var newTitle = issue["title"]?.GetValue<string>();
                if (payload["changes"]?["title"] is not null && newTitle is not null)
                {
                    await commandPipeline.Execute(new RenameIssue(issueId, newTitle));
                }

                if (payload["changes"]?["body"] is not null)
                {
                    await commandPipeline.Execute(new ChangeIssueBody(issueId, issue["body"]?.GetValue<string>() ?? string.Empty));
                }

                break;

            case "labeled" or "unlabeled":
                await commandPipeline.Execute(new ChangeIssueLabels(issueId, ParseLabels(issue)));
                break;

            case "closed":
                await commandPipeline.Execute(new CloseIssue(issueId));
                break;

            case "reopened":
                await commandPipeline.Execute(new ReopenIssue(issueId));
                break;
        }

        // Every issue webhook delivery carries the issue's current assignees and milestone,
        // regardless of which action triggered it - so this mirrors them without needing a
        // dedicated case (and without needing the assigned/unassigned/milestoned/demilestoned
        // event subscriptions, which are actions of the already-subscribed "issues" event).
        await commandPipeline.Execute(new ChangeIssueAssignees(issueId, ParseAssignees(issue)));
        await commandPipeline.Execute(new ChangeIssueMilestone(issueId, ParseMilestone(issue)));
    }

    static async Task HandleIssueCommentEvent(JsonObject payload, ICommandPipeline commandPipeline, IMongoCollection<Repository> repositories)
    {
        if (payload["issue"] is not JsonObject issue ||
            payload["comment"] is not JsonObject comment ||
            payload["repository"] is not JsonObject repository)
        {
            return;
        }

        OrganizationName owner = repository["owner"]?["login"]?.GetValue<string>() ?? string.Empty;
        RepositoryName name = repository["name"]?.GetValue<string>() ?? string.Empty;

        var repositoryId = RepositoryId.From(owner, name);
        var tracked = await repositories.CountDocumentsAsync(tracked => tracked.Id == repositoryId);
        if (tracked == 0)
        {
            return;
        }

        var issueId = IssueId.From(owner, name, issue["number"]?.GetValue<int>() ?? 0);
        CommentId commentId = comment["id"]?.GetValue<long>() ?? 0L;

        switch (payload["action"]?.GetValue<string>())
        {
            case "created":
                await commandPipeline.Execute(new RecordIssueComment(
                    issueId,
                    commentId,
                    comment["user"]?["login"]?.GetValue<string>() ?? string.Empty,
                    comment["body"]?.GetValue<string>() ?? string.Empty,
                    comment["created_at"]?.GetValue<DateTimeOffset>() ?? DateTimeOffset.MinValue));
                break;

            case "edited":
                // Child projections cannot update a comment in place - mirror an edit as the old
                // comment removed and the comment as it now stands recorded.
                await commandPipeline.Execute(new RemoveIssueComment(issueId, commentId));
                await commandPipeline.Execute(new RecordIssueComment(
                    issueId,
                    commentId,
                    comment["user"]?["login"]?.GetValue<string>() ?? string.Empty,
                    comment["body"]?.GetValue<string>() ?? string.Empty,
                    comment["created_at"]?.GetValue<DateTimeOffset>() ?? DateTimeOffset.MinValue));
                break;

            case "deleted":
                await commandPipeline.Execute(new RemoveIssueComment(issueId, commentId));
                break;
        }
    }

    static async Task HandlePullRequestEvent(JsonObject payload, ICommandPipeline commandPipeline, IMongoCollection<Repository> repositories)
    {
        if (payload["pull_request"] is not JsonObject pullRequest || payload["repository"] is not JsonObject repository)
        {
            return;
        }

        OrganizationName owner = repository["owner"]?["login"]?.GetValue<string>() ?? string.Empty;
        RepositoryName name = repository["name"]?.GetValue<string>() ?? string.Empty;

        var repositoryId = RepositoryId.From(owner, name);
        var tracked = await repositories.CountDocumentsAsync(tracked => tracked.Id == repositoryId);
        if (tracked == 0)
        {
            return;
        }

        PullRequestNumber number = pullRequest["number"]?.GetValue<int>() ?? 0;
        var pullRequestId = PullRequestId.From(owner, name, number);

        switch (payload["action"]?.GetValue<string>())
        {
            case "opened":
                await commandPipeline.Execute(new RegisterPullRequest(
                    owner,
                    name,
                    number,
                    pullRequest["title"]?.GetValue<string>() ?? string.Empty,
                    pullRequest["user"]?["login"]?.GetValue<string>() ?? string.Empty,
                    pullRequest["created_at"]?.GetValue<DateTimeOffset>() ?? DateTimeOffset.MinValue,
                    pullRequest["html_url"]?.GetValue<string>() ?? string.Empty,
                    true));
                break;

            case "closed":
                await commandPipeline.Execute(new ClosePullRequest(pullRequestId, pullRequest["merged"]?.GetValue<bool>() ?? false));
                break;

            case "reopened":
                await commandPipeline.Execute(new ReopenPullRequest(pullRequestId));
                break;
        }

        // Every pull request webhook delivery carries the current body, labels, draft state and
        // branches, regardless of which action triggered it - covers edited/labeled/unlabeled/
        // synchronize/ready_for_review/converted_to_draft without a dedicated case for each.
        await commandPipeline.Execute(new UpdatePullRequestDetails(
            pullRequestId,
            pullRequest["body"]?.GetValue<string>() ?? string.Empty,
            ParseLabels(pullRequest),
            pullRequest["draft"]?.GetValue<bool>() ?? false,
            pullRequest["head"]?["ref"]?.GetValue<string>() ?? string.Empty,
            pullRequest["base"]?["ref"]?.GetValue<string>() ?? string.Empty));
    }

    static async Task HandleInstallationEvent(JsonObject payload, ICommandPipeline commandPipeline)
    {
        if (payload["installation"] is not JsonObject installation)
        {
            return;
        }

        InstallationId installationId = installation["id"]?.GetValue<long>() ?? 0L;

        switch (payload["action"]?.GetValue<string>())
        {
            case "created":
                OrganizationName account = installation["account"]?["login"]?.GetValue<string>() ?? string.Empty;
                await commandPipeline.Execute(new RecordGitHubAppInstallation(installationId, account));
                break;

            case "deleted":
                await commandPipeline.Execute(new RemoveGitHubAppInstallation(installationId));
                break;
        }
    }

    static IEnumerable<LabelName> ParseLabels(JsonObject issueOrPullRequest) =>
        issueOrPullRequest["labels"] is JsonArray labels
            ? [.. labels.OfType<JsonObject>().Select(label => new LabelName(label["name"]?.GetValue<string>() ?? string.Empty))]
            : [];

    static IEnumerable<UserName> ParseAssignees(JsonObject issue) =>
        issue["assignees"] is JsonArray assignees
            ? [.. assignees.OfType<JsonObject>().Select(assignee => new UserName(assignee["login"]?.GetValue<string>() ?? string.Empty))]
            : [];

    static MilestoneName ParseMilestone(JsonObject issue) =>
        issue["milestone"] is JsonObject milestone ? milestone["title"]?.GetValue<string>() ?? string.Empty : MilestoneName.NotSet;

    static bool SignatureIsValid(HttpRequest request, string body, string secret)
    {
        if (string.IsNullOrEmpty(secret))
        {
            // No secret configured - local development only.
            return true;
        }

        var signature = request.Headers["X-Hub-Signature-256"].ToString();
        if (!signature.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(body));
        return CryptographicOperations.FixedTimeEquals(
            Convert.FromHexString(signature["sha256=".Length..]),
            expected);
    }
}
