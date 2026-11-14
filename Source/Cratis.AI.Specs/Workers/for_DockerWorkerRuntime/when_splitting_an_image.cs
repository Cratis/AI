// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_DockerWorkerRuntime;

public class when_splitting_an_image : Specification
{
    (string Image, string Tag) _digest;
    (string Image, string Tag) _digestWithPort;
    (string Image, string Tag) _tag;
    (string Image, string Tag) _untagged;

    void Because()
    {
        _digest = DockerWorkerRuntime.SplitImage("repo@sha256:abc123");
        _digestWithPort = DockerWorkerRuntime.SplitImage("registry:5000/repo:tag@sha256:abc123");
        _tag = DockerWorkerRuntime.SplitImage("registry:5000/repo:tag");
        _untagged = DockerWorkerRuntime.SplitImage("registry:5000/repo");
    }

    [Fact] void should_keep_the_digest_reference_whole() => _digest.Image.ShouldEqual("repo@sha256:abc123");
    [Fact] void should_not_pass_a_tag_for_a_digest() => _digest.Tag.ShouldEqual(string.Empty);
    [Fact] void should_keep_ports_and_tags_in_digest_references() => _digestWithPort.Image.ShouldEqual("registry:5000/repo:tag@sha256:abc123");
    [Fact] void should_not_pass_a_tag_for_a_digest_with_a_port() => _digestWithPort.Tag.ShouldEqual(string.Empty);
    [Fact] void should_preserve_mutable_tags() => _tag.ShouldEqual(("registry:5000/repo", "tag"));
    [Fact] void should_preserve_latest_for_untagged_images() => _untagged.ShouldEqual(("registry:5000/repo", "latest"));
}
