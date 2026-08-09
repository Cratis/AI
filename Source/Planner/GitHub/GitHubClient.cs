// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Planner.GitHub.App;

namespace Planner.GitHub;

/// <summary>
/// An <see cref="IGitHubClient"/> implementation on top of the GitHub REST API, authenticating each
/// request with the GitHub App installation token for the organization the request concerns.
/// </summary>
/// <param name="httpClient">The <see cref="HttpClient"/> to use - configured with base address and headers at registration.</param>
/// <param name="tokenResolver">The <see cref="IGitHubAppTokenResolver"/> resolving the installation token per organization.</param>
public class GitHubClient(HttpClient httpClient, IGitHubAppTokenResolver tokenResolver) : IGitHubClient
{
    const int PageSize = 100;

    /// <inheritdoc/>
    public async Task<IEnumerable<GitHubRepository>> GetOrganizationRepositories(OrganizationName organization, CancellationToken cancellationToken = default)
    {
        var repositories = new List<GitHubRepository>();
        for (var page = 1; ; page++)
        {
            var response = await GetJsonArray(organization, $"orgs/{organization.Value}/repos?per_page={PageSize}&page={page}", cancellationToken);
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
            var response = await GetJsonArray(owner, $"repos/{owner.Value}/{repository.Value}/issues?state=all&per_page={PageSize}&page={page}", cancellationToken);
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
            var response = await GetJsonArray(owner, $"repos/{owner.Value}/{repository.Value}/issues/{number.Value}/comments?per_page={PageSize}&page={page}", cancellationToken);
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
        using var response = await Send(owner, HttpMethod.Post, $"repos/{owner.Value}/{repository.Value}/issues/{number.Value}/comments", new StringContent(body, Encoding.UTF8, "application/json"), cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    /// <inheritdoc/>
    public async Task<bool> MergePullRequest(OrganizationName owner, RepositoryName repository, PullRequestNumber number, CancellationToken cancellationToken = default)
    {
        using var response = await Send(owner, HttpMethod.Put, $"repos/{owner.Value}/{repository.Value}/pulls/{number.Value}/merge", new StringContent("{}", Encoding.UTF8, "application/json"), cancellationToken);
        return response.IsSuccessStatusCode;
    }

    /// <inheritdoc/>
    public async Task<bool> IsOrganizationMember(OrganizationName organization, UserName user, CancellationToken cancellationToken = default)
    {
        using var response = await Send(organization, HttpMethod.Get, $"orgs/{organization.Value}/members/{user.Value}", null, cancellationToken);
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

    async Task<JsonArray?> GetJsonArray(OrganizationName owner, string route, CancellationToken cancellationToken)
    {
        using var response = await Send(owner, HttpMethod.Get, route, null, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        return JsonNode.Parse(await response.Content.ReadAsStringAsync(cancellationToken)) as JsonArray;
    }

    async Task<HttpResponseMessage> Send(OrganizationName owner, HttpMethod method, string route, HttpContent? content, CancellationToken cancellationToken)
    {
        var token = await tokenResolver.GetToken(owner, cancellationToken);
        using var request = new HttpRequestMessage(method, new Uri(route, UriKind.Relative)) { Content = content };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await httpClient.SendAsync(request, cancellationToken);
    }
}
