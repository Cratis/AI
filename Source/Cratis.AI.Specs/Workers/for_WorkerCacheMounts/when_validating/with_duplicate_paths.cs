// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_WorkerCacheMounts.when_validating;

public class with_duplicate_paths : Specification
{
    [Fact]
    void should_refuse_duplicate_mirror_paths() => WorkerCacheMounts.TryCreate(new("v1-" + new string('a', 64), [new("https://example.invalid/first.git", "repo.git"), new("https://example.invalid/second.git", "repo.git")]), out _).ShouldBeFalse();

    [Fact]
    void should_refuse_duplicate_clone_urls() => WorkerCacheMounts.TryCreate(new("v1-" + new string('a', 64), [new("https://example.invalid/repo.git", "first.git"), new("https://example.invalid/repo.git", "second.git")]), out _).ShouldBeFalse();
}
