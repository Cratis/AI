// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_WorkerCacheMounts.when_validating;

public class with_nested_paths : Specification
{
    [Theory]
    [InlineData("a/b.git", "a/b.git/x.git")]
    [InlineData("a/b.git/x.git", "a/b.git")]
    void should_refuse_overlapping_mounts(string first, string second) =>
        WorkerCacheMounts.TryCreate(new("v1-" + new string('a', 64), [first, second]), out _).ShouldBeFalse();
}
