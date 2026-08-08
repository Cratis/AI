// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using Planner.Issues.ChangingBody;
using Planner.Issues.ChangingLabels;
using Planner.Issues.Closing;
using Planner.Issues.Comments.Recording;
using Planner.Issues.Comments.Removing;
using Planner.Issues.Registration;
using Planner.Issues.Renaming;
using Planner.Issues.Reopening;
using Planner.Repositories.Adding;
using Planner.Repositories.Listing;

namespace Planner.GitHub.Webhooks;

/// <summary>
/// The transport boundary GitHub webhook deliveries arrive through. Deliveries are validated
/// against the configured secret and translated into the Planner's commands - the main mechanism
/// keeping the issue mirror current.
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
            IOptions<GitHubOptions> options) =>
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

                case "repository" when payload["action"]?.GetValue<string>() == "created":
                    var repository = payload["repository"] as JsonObject;
                    var owner = repository?["owner"]?["login"]?.GetValue<string>();
                    var name = repository?["name"]?.GetValue<string>();
                    if (owner is not null && name is not null)
                    {
                        await commandPipeline.Execute(new AddRepository(owner, name));
                    }

                    break;
            }

            return Results.Ok();
        });

        return app;
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

    static IEnumerable<LabelName> ParseLabels(JsonObject issue) =>
        issue["labels"] is JsonArray labels
            ? [.. labels.OfType<JsonObject>().Select(label => new LabelName(label["name"]?.GetValue<string>() ?? string.Empty))]
            : [];

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
