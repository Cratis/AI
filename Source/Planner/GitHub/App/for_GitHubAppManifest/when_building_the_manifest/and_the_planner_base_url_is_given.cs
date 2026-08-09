// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using System.Text.Json.Nodes;

namespace Planner.GitHub.App.for_GitHubAppManifest.when_building_the_manifest;

public class and_the_planner_base_url_is_given : Specification
{
    JsonObject _manifest;

    void Because() => _manifest = JsonNode.Parse(GitHubAppManifest.Build("https://planner.cratis.io/")) as JsonObject;

    [Fact]
    void should_point_the_webhook_at_the_planner() =>
        _manifest["hook_attributes"]!["url"]!.GetValue<string>().ShouldEqual("https://planner.cratis.io/webhooks/github");

    [Fact]
    void should_redirect_back_to_the_planner_after_registration() =>
        _manifest["redirect_url"]!.GetValue<string>().ShouldEqual("https://planner.cratis.io/github-app/created");

    [Fact]
    void should_subscribe_to_the_issues_event() => Events().ShouldContain("issues");

    [Fact]
    void should_subscribe_to_the_issue_comment_event() => Events().ShouldContain("issue_comment");

    [Fact]
    void should_subscribe_to_the_pull_request_event() => Events().ShouldContain("pull_request");

    [Fact]
    void should_subscribe_to_the_repository_event_so_new_repositories_are_picked_up() =>
        Events().ShouldContain("repository");

    /// <summary>
    /// GitHub delivers the installation lifecycle events to every App implicitly and rejects the whole
    /// manifest with "Default events unsupported: installation" when one is asked for - which blocks the
    /// App from ever being registered.
    /// </summary>
    [Fact]
    void should_not_ask_for_the_implicitly_delivered_installation_event() =>
        Events().ShouldNotContain("installation");

    [Fact]
    void should_not_ask_for_the_implicitly_delivered_installation_repositories_event() =>
        Events().ShouldNotContain("installation_repositories");

    [Fact]
    void should_ask_for_write_access_to_issues() =>
        _manifest["default_permissions"]!["issues"]!.GetValue<string>().ShouldEqual("write");

    IEnumerable<string> Events() =>
        (_manifest["default_events"] as JsonArray)!.Select(@event => @event!.GetValue<string>());
}
#endif
