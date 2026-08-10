// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;

namespace Planner.GitHub.App.for_GitHubAppManifest.when_building_the_manifest;

/// <summary>
/// Every URL in the manifest is one GitHub sends the operator's browser to, so they have to carry the
/// origin the browser actually used - not the in-cluster address the Planner is reached on internally.
/// </summary>
public class and_the_url_comes_from_a_proxied_request : Specification
{
    JsonObject _manifest;

    void Because()
    {
        var request = new DefaultHttpContext().Request;
        request.Scheme = "http";
        request.Host = new HostString("planner");
        request.Headers[RequestOrigin.ForwardedProtoHeader] = "https";
        request.Headers[RequestOrigin.ForwardedHostHeader] = "planner.cratis.io";

        _manifest = JsonNode.Parse(GitHubAppManifest.Build(RequestOrigin.From(request))) as JsonObject;
    }

    [Fact]
    void should_redirect_the_browser_back_to_the_public_origin() =>
        _manifest["redirect_url"]!.GetValue<string>().ShouldEqual("https://planner.cratis.io/github-app/created");

    [Fact]
    void should_send_the_operator_to_the_public_origin_after_installing() =>
        _manifest["setup_url"]!.GetValue<string>().ShouldEqual("https://planner.cratis.io/github-app/installed");

    [Fact]
    void should_point_the_webhook_at_the_public_origin() =>
        _manifest["hook_attributes"]!["url"]!.GetValue<string>().ShouldEqual("https://planner.cratis.io/webhooks/github");

    [Fact]
    void should_present_the_public_origin_as_the_app_url() =>
        _manifest["url"]!.GetValue<string>().ShouldEqual("https://planner.cratis.io");
}
#endif
