// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_WorkerCacheMounts.when_validating;

public class with_invalid_repository_paths : Specification
{
    [Theory]
    [InlineData("../x.git")]
    [InlineData("a/../b.git")]
    [InlineData("a/..")]
    void should_refuse_parent_traversal(string path) =>
        WorkerCacheMounts.TryCreate(new("v1-" + new string('a', 64), [new("https://example.invalid/repo.git", path)]), out _).ShouldBeFalse();
}
