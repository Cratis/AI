// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_WorkerCacheMounts.when_validating;

public class with_invalid_clone_urls : Specification
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("owner/repo.git")]
    [InlineData("http://example.invalid/repo.git")]
    [InlineData("ssh://example.invalid/repo.git")]
    [InlineData("https://synthetic@example.invalid/repo.git")]
    [InlineData("https://@example.invalid/repo.git")]
    [InlineData("https://example.invalid/repo.git?query")]
    [InlineData("https://example.invalid/repo.git?")]
    [InlineData("https://example.invalid/repo.git#fragment")]
    [InlineData("https://example.invalid/repo.git#")]
    [InlineData("https://example.invalid/repo\t.git")]
    [InlineData("https://example.invalid/repo\n.git")]
    [InlineData(" https://example.invalid/repo.git")]
    void should_refuse_the_url(string? url) => WorkerCacheMounts.TryCreate(new("v1-" + new string('a', 64), [new(url!, "example.invalid/owner/repo.git")]), out _).ShouldBeFalse();
}
