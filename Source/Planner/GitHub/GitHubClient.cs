// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Planner.GitHub;

/// <summary>
/// An <see cref="IGitHubClient"/> implementation on top of the GitHub REST API.
/// </summary>
/// <param name="httpClient">The <see cref="HttpClient"/> to use - configured with base address and headers at registration.</param>
public class GitHubClient(HttpClient httpClient) : IGitHubClient
{
    const int PageSize = 100;

    /// <inheritdoc/>
    public async Task<IEnumerable<GitHubRepository>> GetOrganizationRepositories(OrganizationName organization, CancellationToken cancellationToken = default)
    {
        var repositories = new List<GitHubRepository>();
        for (var page = 1; ; page++)
        {
            var response = await GetJsonArray($"orgs/{organization.Value}/repos?per_page={PageSize}&page={page}", cancellationToken);
            if (response is null || response.Count == 0)
            {
                break;
            }

            repositories.AddRange(response
                .OfType<JsonObject>()
                .Select(repository => new GitHubRepository(
                    repository["owner"]?["login"]?.GetValue<string>() ?? organization.Value,
                    repository["name"]!.GetValue<string>(),
                    repository["private"]?.GetValue<bool>() ?? false)));

            if (response.Count < PageSize)
            {
                break;
            }
        }

        return repositories;
    }

    /// <inheritdoc/>
    public async Task<IEnumerable<GitHubIssue>> GetIssues(OrganizationName owner, RepositoryName repository, CancellationToken cancellationToken = default)
    {
        var issues = new List<GitHubIssue>();
        for (var page = 1; ; page++)
        {
            var response = await GetJsonArray($"repos/{owner.Value}/{repository.Value}/issues?state=all&per_page={PageSize}&page={page}", cancellationToken);
            if (response is null || response.Count == 0)
            {
                break;
            }

            issues.AddRange(response
                .OfType<JsonObject>()
                .Where(issue => issue["pull_request"] is null)
                .Select(AsIssue));

            if (response.Count < PageSize)
            {
                break;
            }
        }

        return issues;
    }

    /// <inheritdoc/>
    public async Task<IEnumerable<GitHubComment>> GetIssueComments(OrganizationName owner, RepositoryName repository, IssueNumber number, CancellationToken cancellationToken = default)
    {
        var comments = new List<GitHubComment>();
        for (var page = 1; ; page++)
        {
            var response = await GetJsonArray($"repos/{owner.Value}/{repository.Value}/issues/{number.Value}/comments?per_page={PageSize}&page={page}", cancellationToken);
            if (response is null || response.Count == 0)
            {
                break;
            }

            comments.AddRange(response
                .OfType<JsonObject>()
                .Select(comment => new GitHubComment(
                    comment["id"]?.GetValue<long>() ?? 0L,
                    comment["user"]?["login"]?.GetValue<string>() ?? string.Empty,
                    comment["body"]?.GetValue<string>() ?? string.Empty,
                    comment["created_at"]?.GetValue<DateTimeOffset>() ?? DateTimeOffset.MinValue)));

            if (response.Count < PageSize)
            {
                break;
            }
        }

        return comments;
    }

    /// <inheritdoc/>
    public async Task AddIssueComment(OrganizationName owner, RepositoryName repository, IssueNumber number, string comment, CancellationToken cancellationToken = default)
    {
        var body = JsonSerializer.Serialize(new { body = comment });
        using var content = new StringContent(body, Encoding.UTF8, "application/json");
        using var response = await httpClient.PostAsync(new Uri($"repos/{owner.Value}/{repository.Value}/issues/{number.Value}/comments", UriKind.Relative), content, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    /// <inheritdoc/>
    public async Task<bool> MergePullRequest(OrganizationName owner, RepositoryName repository, PullRequestNumber number, CancellationToken cancellationToken = default)
    {
        using var content = new StringContent("{}", Encoding.UTF8, "application/json");
        using var response = await httpClient.PutAsync(new Uri($"repos/{owner.Value}/{repository.Value}/pulls/{number.Value}/merge", UriKind.Relative), content, cancellationToken);
        return response.IsSuccessStatusCode;
    }

    /// <inheritdoc/>
    public async Task<bool> IsOrganizationMember(OrganizationName organization, UserName user, CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.GetAsync(new Uri($"orgs/{organization.Value}/members/{user.Value}", UriKind.Relative), cancellationToken);
        return response.StatusCode == HttpStatusCode.NoContent;
    }

    static GitHubIssue AsIssue(JsonObject issue) => new(
        issue["number"]!.GetValue<int>(),
        issue["title"]?.GetValue<string>() ?? string.Empty,
        issue["type"] is JsonObject type ? type["name"]?.GetValue<string>() ?? string.Empty : string.Empty,
        issue["user"]?["login"]?.GetValue<string>() ?? string.Empty,
        issue["created_at"]?.GetValue<DateTimeOffset>() ?? DateTimeOffset.MinValue,
        GitHubAuthorAssociations.Map(issue["author_association"]?.GetValue<string>()),
        issue["state"]?.GetValue<string>() == "open",
        issue["body"]?.GetValue<string>() ?? string.Empty,
        ParseLabels(issue),
        issue["comments"]?.GetValue<int>() ?? 0);

    static IEnumerable<LabelName> ParseLabels(JsonObject issue) =>
        issue["labels"] is JsonArray labels
            ? [.. labels.OfType<JsonObject>().Select(label => new LabelName(label["name"]?.GetValue<string>() ?? string.Empty))]
            : [];

    async Task<JsonArray?> GetJsonArray(string route, CancellationToken cancellationToken)
    {
        using var response = await httpClient.GetAsync(new Uri(route, UriKind.Relative), cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        return JsonNode.Parse(await response.Content.ReadAsStringAsync(cancellationToken)) as JsonArray;
    }
}
