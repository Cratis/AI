// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_WorkerCacheMounts.when_validating;

public class with_unsupported_characters : Specification
{
    [Theory]
    [InlineData("a/~b.git")]
    [InlineData("a/b:rw.git")]
    [InlineData("a/b c.git")]
    void should_refuse_the_path(string path) =>
        WorkerCacheMounts.TryCreate(new("v1-" + new string('a', 64), [new("https://example.invalid/repo.git", path)]), out _).ShouldBeFalse();
}
